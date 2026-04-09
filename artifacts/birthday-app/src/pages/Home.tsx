import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Plus, Search, Settings, CalendarHeart, Bell, X, MessageCircle, Mail, LogOut, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUpcomingBirthdays, useContacts } from "@/hooks/use-contacts";
import { useAuth } from "@/hooks/use-auth";
import { ContactCard } from "@/components/ContactCard";
import { Input } from "@/components/ui/input";
import { detectPlatform, PLATFORM_LABEL, PLATFORM_ICON, PLATFORM_COLOR } from "@/lib/platform";

const BANNER_DISMISS_KEY = "birthday_mp_banner_dismissed";
const PREF_WECHAT_NOTIFY  = "birthday_pref_wechat_notify";
const PREF_EMAIL_NOTIFY   = "birthday_pref_email_notify";

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
    setWechatNotifyState(next);
    localStorage.setItem(PREF_WECHAT_NOTIFY, String(next));
    if (!next) {
      sessionStorage.setItem(BANNER_DISMISS_KEY, "1");
      setShowBanner(false);
    }
  };

  const toggleEmail = () => {
    const next = !emailNotify;
    setEmailNotifyState(next);
    localStorage.setItem(PREF_EMAIL_NOTIFY, String(next));
  };

  // ── 关注公众号横幅 ────────────────────────────────────────────────────────
  const [showBanner, setShowBanner] = useState(false);
  const [mpName, setMpName]         = useState("");

  useEffect(() => {
    if (!user) return;
    const isRealWechat = user.openId && !String(user.openId).startsWith("mock:");
    if (!isRealWechat) return;
    if (sessionStorage.getItem(BANNER_DISMISS_KEY)) return;
    if (!wechatNotify) return;

    fetch(`${import.meta.env.BASE_URL}api/auth/wechat/public-config`)
      .then(r => r.json())
      .then((cfg: { notifyEnabled?: boolean; accountName?: string }) => {
        if (cfg.notifyEnabled && !sessionStorage.getItem(BANNER_DISMISS_KEY)) {
          setMpName(cfg.accountName || "");
          setShowBanner(true);
        }
      })
      .catch(() => {});
  }, [user, wechatNotify]);

  const dismissBanner = () => {
    sessionStorage.setItem(BANNER_DISMISS_KEY, "1");
    setShowBanner(false);
  };

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

  const avatarText = user.nickname ? user.nickname[0].toUpperCase() : "U";

  return (
    <div className="app-container flex flex-col bg-slate-50/50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-border/50 px-4 pt-12 pb-4">
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

      {/* 关注公众号横幅 */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-3 flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Bell className="w-4 h-4 text-white" />
              </div>
              <p className="flex-1 text-sm text-white leading-snug">
                关注{mpName ? <strong className="font-semibold">「{mpName}」</strong> : "公众号"}，第一时间收到生日提醒推送通知
              </p>
              <button
                onClick={dismissBanner}
                className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                aria-label="关闭提示"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              <h2 className="text-sm font-semibold text-muted-foreground mb-2 px-2">搜索结果 ({searchResults?.length || 0})</h2>
              {searchResults?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">没有找到相关亲友</div>
              ) : (
                searchResults?.map((contact, i) => (
                  <ContactCard key={contact.id} contact={contact} index={i} />
                ))
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
      </main>

      {/* FAB */}
      <div className="fixed bottom-6 right-0 left-0 max-w-md mx-auto pointer-events-none px-6 flex justify-end z-50">
        <Link href="/contact/new" className="pointer-events-auto">
          <button className="h-14 w-14 rounded-full bg-gradient-to-r from-primary to-primary/80 text-white shadow-[0_8px_30px_rgba(225,29,72,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
            <Plus className="h-7 w-7" />
          </button>
        </Link>
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

                  {/* Email notify */}
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
