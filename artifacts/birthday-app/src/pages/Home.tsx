import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Plus, Search, Settings, CalendarHeart, Bell, X, MessageCircle, Mail, LogOut, ChevronRight, Heart, Timer, Sparkles, CalendarDays } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUpcomingBirthdays, useContacts } from "@/hooks/use-contacts";
import { useAuth, getAuthHeaders } from "@/hooks/use-auth";
import { ContactCard } from "@/components/ContactCard";
import { Input } from "@/components/ui/input";
import { detectPlatform, PLATFORM_LABEL, PLATFORM_ICON, PLATFORM_COLOR } from "@/lib/platform";

const BASE = import.meta.env.BASE_URL;

// WeChat JS-SDK global type declaration
declare global {
  interface Window {
    wx?: {
      config(cfg: object): void;
      ready(cb: () => void): void;
      error(cb: (res: { errMsg: string }) => void): void;
      updateAppMessageShareData(opts: object): void;
      updateTimelineShareData(opts: object): void;
    };
  }
}

/** 动态加载微信 JSSDK 脚本（幂等，加载过则直接 resolve） */
function loadWechatJsSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.wx) { resolve(); return; }
    const existing = document.getElementById("wx-jssdk");
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const script = document.createElement("script");
    script.id  = "wx-jssdk";
    script.src = "https://res.wx.qq.com/open/js/jweixin-1.6.0.js";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/** 调用后台签名接口并初始化分享 */
async function initWechatShare(base: string): Promise<void> {
  try {
    await loadWechatJsSdk();

    // 微信要求 url 不含 hash
    const pageUrl = location.href.split("#")[0];
    const resp = await fetch(
      `${base}api/share/jssdk-config?url=${encodeURIComponent(pageUrl)}`
    );
    if (!resp.ok) return;
    const cfg = await resp.json() as {
      appId: string; timestamp: number; nonceStr: string; signature: string;
      shareTitle: string; shareDesc: string; shareImgUrl: string; shareLink: string;
    };

    window.wx?.config({
      debug:      false,
      appId:      cfg.appId,
      timestamp:  cfg.timestamp,
      nonceStr:   cfg.nonceStr,
      signature:  cfg.signature,
      jsApiList:  ["updateAppMessageShareData", "updateTimelineShareData"],
    });

    window.wx?.ready(() => {
      const shareOpts = {
        title:   cfg.shareTitle,
        desc:    cfg.shareDesc,
        link:    cfg.shareLink,
        imgUrl:  cfg.shareImgUrl,
      };
      window.wx?.updateAppMessageShareData(shareOpts);
      window.wx?.updateTimelineShareData({ title: cfg.shareTitle, link: cfg.shareLink, imgUrl: cfg.shareImgUrl });
    });
  } catch {
    // 静默失败，不影响正常使用
  }
}

interface AppEvent {
  id: number;
  type: "anniversary" | "countdown" | "other";
  name: string;
  eventDate: string | null;
  person: string | null;
  reminderTime: string | null;
  daysUntil: number | null;
}

interface UpcomingEvents {
  anniversaries: AppEvent[];
  countdowns: AppEvent[];
  others: AppEvent[];
}

function calcAnniversaryYear(eventDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const origin = new Date(eventDate + "T00:00:00");
  const thisYearAnniv = new Date(today.getFullYear(), origin.getMonth(), origin.getDate());
  const targetYear = thisYearAnniv < today ? today.getFullYear() + 1 : today.getFullYear();
  return targetYear - origin.getFullYear();
}

const PREF_WECHAT_NOTIFY  = "birthday_pref_wechat_notify";
const PREF_EMAIL_NOTIFY   = "birthday_pref_email_notify";
const MP_FOLLOWED_KEY     = "birthday_mp_followed";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, logout, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [search, setSearch] = useState("");

  // ── Settings panel ────────────────────────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [wechatNotify, setWechatNotifyState] = useState(() =>
    localStorage.getItem(PREF_WECHAT_NOTIFY) !== "false"
  );
  const [emailNotify, setEmailNotifyState] = useState(() =>
    localStorage.getItem(PREF_EMAIL_NOTIFY) !== "false"
  );

  const toggleWechat = () => {
    const next = !wechatNotify;
    if (next && !mpFollowed) {
      setShowQrModal(true);
      return;
    }
    setWechatNotifyState(next);
    localStorage.setItem(PREF_WECHAT_NOTIFY, String(next));
  };

  const toggleEmail = () => {
    const next = !emailNotify;
    setEmailNotifyState(next);
    localStorage.setItem(PREF_EMAIL_NOTIFY, String(next));
  };

  // ── 关注公众号横幅 ────────────────────────────────────────────────────────
  const [mpFollowed, setMpFollowed] = useState(() =>
    localStorage.getItem(MP_FOLLOWED_KEY) === "1"
  );
  const [showQrModal, setShowQrModal] = useState(false);
  const [mpName, setMpName] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/auth/wechat/public-config`)
      .then(r => r.json())
      .then((cfg: { accountName?: string }) => {
        if (cfg.accountName) setMpName(cfg.accountName);
      })
      .catch(() => {});
  }, []);

  // 认证后查询微信服务器，确认用户是否已真实关注公众号
  useEffect(() => {
    if (!isAuthenticated || isAuthLoading || mpFollowed) return;
    const platform = detectPlatform();
    // 只在公众号 H5 环境下需要查关注状态；mock 登录直接跳过
    if (platform !== "wechat_mp") return;

    fetch(`${BASE}api/auth/wechat/subscribe-status`, {
      headers: getAuthHeaders(),
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { subscribed?: boolean } | null) => {
        if (data?.subscribed) {
          // 已关注：同步本地标记，隐藏横幅
          localStorage.setItem(MP_FOLLOWED_KEY, "1");
          setMpFollowed(true);
          setWechatNotifyState(true);
          localStorage.setItem(PREF_WECHAT_NOTIFY, "true");
        }
      })
      .catch(() => {});
  }, [isAuthenticated, isAuthLoading]);

  const markFollowed = () => {
    localStorage.setItem(MP_FOLLOWED_KEY, "1");
    setMpFollowed(true);
    setShowQrModal(false);
    setWechatNotifyState(true);
    localStorage.setItem(PREF_WECHAT_NOTIFY, "true");
  };

  // 微信 JS-SDK 分享初始化（仅在公众号 H5 环境下）
  useEffect(() => {
    if (!isAuthenticated || isAuthLoading) return;
    const platform = detectPlatform();
    if (platform !== "wechat_mp") return;
    initWechatShare(BASE);
  }, [isAuthenticated, isAuthLoading]);

  // ── FAB menu ───────────────────────────────────────────────────────────────
  const [showFab, setShowFab] = useState(false);

  // ── Events ─────────────────────────────────────────────────────────────────
  const [events, setEvents] = useState<UpcomingEvents>({ anniversaries: [], countdowns: [], others: [] });
  const fetchEvents = () => {
    if (!user) return;
    fetch(`${BASE}api/events/upcoming`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setEvents(d))
      .catch(() => {});
  };
  useEffect(() => { fetchEvents(); }, [user]);

  // Queries
  const { data: upcoming, isLoading: isUpcomingLoading } = useUpcomingBirthdays();
  const { data: searchResults, isLoading: isSearchLoading } = useContacts(search.trim() ? search : undefined);

  // Fallback: if a wechat_token somehow lands on the home route, capture it
  // before the auth redirect fires and route it through /login for proper handling.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wechatToken = params.get("wechat_token") || params.get("mp_token");
    if (wechatToken) {
      window.history.replaceState({}, "", window.location.pathname);
      setLocation(`/login?wechat_token=${encodeURIComponent(wechatToken)}`);
    }
  }, [setLocation]);

  React.useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, isAuthLoading, setLocation]);

  if (isAuthLoading || !user) {
    return <div className="app-container flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div></div>;
  }

  const isSearching = search.trim().length > 0;
  const showLoading = isSearching ? isSearchLoading : isUpcomingLoading;

  // 本地过滤 events（已加载到内存，无需额外请求）
  const allEventsList = [
    ...events.anniversaries,
    ...events.countdowns,
    ...events.others,
  ];
  const filteredEvents = isSearching
    ? allEventsList.filter((e) => {
        const q = search.trim().toLowerCase();
        return (
          e.name.toLowerCase().includes(q) ||
          (e.person ?? "").toLowerCase().includes(q)
        );
      })
    : [];

  const avatarText = user.nickname ? user.nickname[0].toUpperCase() : "U";

  return (
    <div className="app-container flex flex-col bg-slate-50/50">

      {/* ── 关注公众号顶部横幅 (不可关闭) ───────────────────────────────── */}
      {!mpFollowed && (
        <button
          onClick={() => setShowQrModal(true)}
          className="w-full bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-3 flex items-center gap-3 text-white flex-shrink-0"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Bell className="w-4 h-4 text-white" />
          </div>
          <p className="flex-1 text-sm leading-snug text-left">
            关注{mpName ? <strong className="font-semibold">「{mpName}」</strong> : <strong className="font-semibold">「生日通」</strong>}，第一时间收到生日提醒推送通知
          </p>
          <span className="flex-shrink-0 text-xs bg-white/25 rounded-full px-2.5 py-1 font-medium">
            去关注
          </span>
        </button>
      )}

      {/* ── 二维码弹窗 ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showQrModal && (
          <>
            <motion.div
              key="qr-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
              onClick={() => setShowQrModal(false)}
            >
              <motion.div
                key="qr-sheet"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="w-full max-w-md bg-white rounded-t-3xl px-6 pt-6 pb-10 flex flex-col items-center gap-5"
                onClick={e => e.stopPropagation()}
              >
                {/* 拖动条 */}
                <div className="w-10 h-1 rounded-full bg-gray-200 mb-1" />

                <div className="flex flex-col items-center gap-1">
                  <h2 className="text-lg font-bold">关注公众号</h2>
                  <p className="text-sm text-muted-foreground text-center">
                    长按识别二维码，关注{mpName ? `「${mpName}」` : "「生日通」"}后<br />即可接收生日提醒推送通知
                  </p>
                </div>

                {/* 二维码 */}
                <div className="p-3 bg-white rounded-2xl shadow-lg border border-gray-100">
                  <img
                    src={`${import.meta.env.BASE_URL}mp-qrcode.jpg`}
                    alt="公众号二维码"
                    className="w-52 h-52 object-contain"
                    draggable={false}
                  />
                </div>

                <p className="text-xs text-muted-foreground">长按上方二维码 → 识别图中二维码 → 关注</p>

                <button
                  onClick={markFollowed}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold text-sm"
                >
                  我已关注，不再提醒
                </button>

                <button
                  onClick={() => setShowQrModal(false)}
                  className="text-sm text-muted-foreground"
                >
                  稍后再说
                </button>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header
        className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-border/50 px-4 pb-4"
        style={{ paddingTop: mpFollowed ? "max(1rem, env(safe-area-inset-top))" : "1rem" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CalendarHeart className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold font-display tracking-tight">生日通</h1>
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
            aria-label="设置"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <Input
          placeholder="搜索亲友..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="w-5 h-5" />}
          className="bg-gray-100/80 border-transparent shadow-inner focus-visible:bg-white focus-visible:border-primary/30"
        />
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 overflow-y-auto pb-28">
        <AnimatePresence mode="wait">
          {showLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-2xl p-4 h-24 animate-pulse border border-border flex items-center gap-4">
                  <div className="w-14 h-14 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </motion.div>
          ) : isSearching ? (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {/* 搜索结果标题：联系人 + 事件总数 */}
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-2">
                搜索结果（{(searchResults?.length || 0) + filteredEvents.length} 条）
              </h2>

              {/* 无结果 */}
              {(searchResults?.length === 0 && filteredEvents.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">没有找到相关记录</div>
              )}

              {/* 联系人结果 */}
              {(searchResults?.length ?? 0) > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground px-2 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />生日联系人
                  </p>
                  {searchResults!.map((contact, i) => (
                    <ContactCard key={contact.id} contact={contact} index={i} />
                  ))}
                </div>
              )}

              {/* 事件结果 */}
              {filteredEvents.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground px-2 flex items-center gap-1.5 mt-2">
                    <CalendarDays className="w-3.5 h-3.5" />纪念日 / 倒数日 / 其它
                  </p>
                  {filteredEvents.map((e) => {
                    const cfg =
                      e.type === "anniversary"
                        ? { icon: <Heart className="w-5 h-5" />, bg: "bg-rose-50", color: "text-rose-500", label: "纪念日" }
                        : e.type === "countdown"
                        ? { icon: <Timer className="w-5 h-5" />, bg: "bg-orange-50", color: "text-orange-500", label: "倒数日" }
                        : { icon: <Sparkles className="w-5 h-5" />, bg: "bg-violet-50", color: "text-violet-500", label: "其它提醒" };
                    const sub =
                      e.type === "anniversary"
                        ? `${e.person ? e.person + " · " : ""}${e.eventDate ?? ""}`
                        : e.type === "countdown"
                        ? `目标日期：${e.eventDate ?? ""}`
                        : e.reminderTime ?? "";
                    return (
                      <button
                        key={`evt-${e.id}`}
                        onClick={() => setLocation(`/event/${e.id}`)}
                        className="w-full text-left bg-white rounded-2xl border border-border/50 px-4 py-3.5 flex items-center gap-3 shadow-sm hover:shadow-md transition-all active:scale-98"
                      >
                        <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center ${cfg.color} flex-shrink-0`}>
                          {cfg.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{e.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="upcoming"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {(!upcoming?.imminent.length && !upcoming?.soon.length && !upcoming?.monthly.length) && (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="w-24 h-24 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mb-6">
                    <CalendarHeart className="w-12 h-12" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">还没有添加任何亲友</h3>
                  <p className="text-muted-foreground text-sm mb-6">点击右下角按钮，记录重要的日子吧</p>
                </div>
              )}

              {upcoming?.imminent && upcoming.imminent.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-primary mb-3 px-2 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-primary rounded-full"></span>
                    即将过生日 <span className="text-xs font-normal bg-primary/10 px-2 py-0.5 rounded-full">{upcoming.imminent.length}</span>
                  </h2>
                  <div className="space-y-3">
                    {upcoming.imminent.map((c, i) => <ContactCard key={c.id} contact={c} index={i} />)}
                  </div>
                </section>
              )}

              {upcoming?.soon && upcoming.soon.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-orange-500 mb-3 px-2 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
                    近期过生日 <span className="text-xs font-normal bg-orange-100 px-2 py-0.5 rounded-full">{upcoming.soon.length}</span>
                  </h2>
                  <div className="space-y-3">
                    {upcoming.soon.map((c, i) => <ContactCard key={c.id} contact={c} index={i} />)}
                  </div>
                </section>
              )}

              {upcoming?.monthly && upcoming.monthly.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-slate-500 mb-3 px-2 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-slate-400 rounded-full"></span>
                    一个月后生日 <span className="text-xs font-normal bg-slate-200 px-2 py-0.5 rounded-full">{upcoming.monthly.length}</span>
                  </h2>
                  <div className="space-y-3">
                    {upcoming.monthly.map((c, i) => <ContactCard key={c.id} contact={c} index={i} />)}
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 纪念日 section ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {events.anniversaries.length > 0 && (
            <motion.section
              key="anniversaries"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4"
            >
              <h2 className="text-sm font-bold text-rose-500 mb-3 px-2 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-rose-400 rounded-full"></span>
                纪念日
              </h2>
              <div className="space-y-3">
                {events.anniversaries.map(e => (
                  <button
                    key={e.id}
                    onClick={() => setLocation(`/event/${e.id}`)}
                    className="w-full text-left bg-white rounded-2xl border border-border/50 px-4 py-3.5 flex items-center gap-3 shadow-sm hover:shadow-md transition-all active:scale-98"
                  >
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 flex-shrink-0">
                      <Heart className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{e.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {e.person ? e.person + " · " : ""}{e.eventDate ?? ""}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                      {e.eventDate ? (() => {
                        const yr = calcAnniversaryYear(e.eventDate);
                        return e.daysUntil === 0 ? (
                          <span className="text-xs font-bold text-rose-500 bg-rose-50 rounded-full px-2 py-0.5">
                            今天 · {yr}周年
                          </span>
                        ) : e.daysUntil !== null ? (
                          <>
                            <span className="text-xs font-semibold text-rose-400">{e.daysUntil} 天后</span>
                            <span className="text-[10px] text-muted-foreground">{yr} 周年纪念日</span>
                          </>
                        ) : null;
                      })() : null}
                      <ChevronRight className="w-4 h-4 text-muted-foreground mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── 倒数日 section ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {events.countdowns.length > 0 && (
            <motion.section
              key="countdowns"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4"
            >
              <h2 className="text-sm font-bold text-orange-500 mb-3 px-2 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-orange-400 rounded-full"></span>
                倒数日
              </h2>
              <div className="space-y-3">
                {events.countdowns.map(e => (
                  <button
                    key={e.id}
                    onClick={() => setLocation(`/event/${e.id}`)}
                    className="w-full text-left bg-white rounded-2xl border border-border/50 px-4 py-3.5 flex items-center gap-3 shadow-sm hover:shadow-md transition-all active:scale-98"
                  >
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0">
                      <Timer className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{e.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">目标日期：{e.eventDate ?? ""}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {e.daysUntil !== null && e.daysUntil >= 0 ? (
                        <span className={`text-sm font-bold ${e.daysUntil === 0 ? "text-orange-500" : "text-orange-400"}`}>
                          {e.daysUntil === 0 ? "今天" : `还有 ${e.daysUntil} 天`}
                        </span>
                      ) : e.daysUntil !== null ? (
                        <span className="text-xs text-muted-foreground">已过期</span>
                      ) : null}
                      <ChevronRight className="w-4 h-4 text-muted-foreground mt-0.5 ml-auto" />
                    </div>
                  </button>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── 其它提醒 section ────────────────────────────────────────────── */}
        <AnimatePresence>
          {events.others.length > 0 && (
            <motion.section
              key="others"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4"
            >
              <h2 className="text-sm font-bold text-violet-500 mb-3 px-2 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-violet-400 rounded-full"></span>
                其它提醒
              </h2>
              <div className="space-y-3">
                {events.others.map(e => (
                  <button
                    key={e.id}
                    onClick={() => setLocation(`/event/${e.id}`)}
                    className="w-full text-left bg-white rounded-2xl border border-border/50 px-4 py-3.5 flex items-center gap-3 shadow-sm hover:shadow-md transition-all active:scale-98"
                  >
                    <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-500 flex-shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{e.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{e.reminderTime ?? ""}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* FAB – expandable menu */}
      <AnimatePresence>
        {showFab && (
          <motion.div
            key="fab-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowFab(false)}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 right-0 left-0 max-w-md mx-auto pointer-events-none px-6 flex flex-col items-end z-50">
        {/* Sub-buttons */}
        <AnimatePresence>
          {showFab && (
            <motion.div
              key="fab-items"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex flex-col items-end gap-2 mb-3 pointer-events-auto"
            >
              {([
                { type: "anniversary", label: "纪念日", icon: <Heart className="w-4 h-4" />, bg: "bg-rose-500" },
                { type: "countdown",   label: "倒数日", icon: <Timer className="w-4 h-4" />, bg: "bg-orange-500" },
                { type: "other",       label: "其它提醒", icon: <Sparkles className="w-4 h-4" />, bg: "bg-violet-500" },
                { type: "contact",     label: "添加生日", icon: <CalendarDays className="w-4 h-4" />, bg: "bg-primary" },
              ] as const).reverse().map(item => (
                <button
                  key={item.type}
                  onClick={() => {
                    setShowFab(false);
                    setLocation(item.type === "contact" ? "/contact/new" : `/event/new/${item.type}`);
                  }}
                  className={`flex items-center gap-2.5 ${item.bg} text-white rounded-full pl-3.5 pr-4 py-2.5 shadow-lg text-sm font-medium`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main FAB button */}
        <button
          className="pointer-events-auto h-14 w-14 rounded-full bg-gradient-to-r from-primary to-primary/80 text-white shadow-[0_8px_30px_rgba(225,29,72,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          onClick={() => setShowFab(v => !v)}
          aria-label="添加"
        >
          <motion.div animate={{ rotate: showFab ? 45 : 0 }} transition={{ duration: 0.2 }}>
            <Plus className="h-7 w-7" />
          </motion.div>
        </button>
      </div>

      {/* Settings Bottom Sheet */}
      <AnimatePresence>
        {showSettings && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowSettings(false)}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-white rounded-t-3xl shadow-2xl overflow-hidden"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>

              {/* Header row */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <h2 className="text-base font-bold tracking-tight">设置</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 rounded-full text-muted-foreground hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Profile section */}
              <div className="flex items-center gap-4 px-5 py-5 border-b border-gray-100">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl.startsWith("http") ? user.avatarUrl : `${import.meta.env.BASE_URL}${user.avatarUrl.replace(/^\//, "")}`}
                    alt={user.nickname}
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-primary/20"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white text-xl font-bold">
                    {avatarText}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-base leading-tight">{user.nickname || "用户"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {user.openId && !String(user.openId).startsWith("mock:") ? "微信用户" : "访客账号"}
                  </p>
                  <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium mt-1.5 ${PLATFORM_COLOR[detectPlatform()]}`}>
                    {PLATFORM_ICON[detectPlatform()]} {PLATFORM_LABEL[detectPlatform()]}
                  </span>
                </div>
              </div>

              {/* Notification settings */}
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">消息提醒</p>

                <div className="bg-gray-50 rounded-2xl overflow-hidden divide-y divide-gray-100">
                  {/* WeChat notify */}
                  <div className="flex items-center gap-3 px-4 py-4">
                    <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-4.5 h-4.5 text-green-600 w-[18px] h-[18px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">公众号生日提醒</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">通过微信公众号推送生日通知</p>
                    </div>
                    <button
                      onClick={toggleWechat}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${wechatNotify ? "bg-green-500" : "bg-gray-200"}`}
                      role="switch"
                      aria-checked={wechatNotify}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${wechatNotify ? "translate-x-5" : "translate-x-0"}`}
                      />
                    </button>
                  </div>

                  {/* Email notify – H5 only */}
                  {detectPlatform() !== "wechat_mp" && (
                  <div className="flex items-center gap-3 px-4 py-4">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-[18px] h-[18px] text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">邮件生日通知</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">通过邮件发送生日提醒消息</p>
                    </div>
                    <button
                      onClick={toggleEmail}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${emailNotify ? "bg-blue-500" : "bg-gray-200"}`}
                      role="switch"
                      aria-checked={emailNotify}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${emailNotify ? "translate-x-5" : "translate-x-0"}`}
                      />
                    </button>
                  </div>
                  )}
                </div>
              </div>

              {/* Logout */}
              <div className="px-5 pb-8">
                <button
                  onClick={() => { setShowSettings(false); logout(); }}
                  className="w-full flex items-center justify-between px-4 py-4 bg-gray-50 rounded-2xl text-sm font-medium text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                      <LogOut className="w-[18px] h-[18px] text-red-500" />
                    </div>
                    退出登录
                  </div>
                  <ChevronRight className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
