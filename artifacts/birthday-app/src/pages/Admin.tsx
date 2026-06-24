import { useState, useEffect, Fragment } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Users,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  LogOut,
  Settings,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  FileText,
  Bell,
  Play,
  Clock,
  Sparkles,
  Zap,
  Mail,
  Send,
  ShieldCheck,
  Share2,
  Wrench,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  Smile,
  Lock,
} from "lucide-react";

const ADMIN_KEY = "birthday-admin-2024";

interface ContactRecord {
  id: number;
  name: string;
  birthdayMonth: number;
  birthdayDay: number;
  birthYear: number | null;
  birthdayLunar: boolean;
  relation: string | null;
  createdAt: string;
}

interface UserRecord {
  id: number;
  openId: string | null;
  oaOpenId: string | null;
  mpSubscribed: boolean;
  unionId: string | null;
  nickname: string;
  avatarUrl: string | null;
  createdAt: string;
  lastAccessAt: string | null;
  contactCount: number;
  eventCount: number;
  capsuleCount: number;
  contacts: ContactRecord[];
}

interface StatsData {
  totalUsers: number;
  totalContacts: number;
  totalEvents: number;
  totalCapsules: number;
  totalEntries: number;
  page: number;
  pageSize: number;
  totalPages: number;
  users: UserRecord[];
}

interface AnalyticsOverview {
  totalUsers: number;
  newToday: number;
  newThisWeek: number;
  oaFollowers: number;
  mpSubscribers: number;
  totalContacts: number;
  totalEvents: number;
  totalCapsules: number;
}

interface DailyPoint {
  date: string;
  count?: number;
  contacts?: number;
  events?: number;
  capsules?: number;
}

interface AnalyticsData {
  overview: AnalyticsOverview;
  dailyUsers: DailyPoint[];
  dailyContent: DailyPoint[];
  dailyLaunches: DailyPoint[];
}

interface WechatConfig {
  // 公众号 (H5 OAuth)
  oaAppId: string;
  oaAppSecret: string;
  oaAppSecretSet: boolean;
  oaDomain: string;
  oaAccountName: string;
  serverToken: string;
  // 小程序 (Mini Program)
  mpAppId: string;
  mpAppSecret: string;
  mpAppSecretSet: boolean;
  mpAppIdActive?: string;
  mpAppSecretActive?: string;
  mpAppIdSource?: "env" | "db" | "none";
  mpAppSecretSource?: "env" | "db" | "none";
  // 登录模式
  h5LoginMode: "wechat_oa" | "mock";
  mpLoginMode: "wechat_mp" | "mock";
}

function formatBirthday(c: ContactRecord) {
  const cal = c.birthdayLunar ? "农历" : "公历";
  const year = c.birthYear ? `${c.birthYear}年` : "";
  return `${cal} ${year}${c.birthdayMonth}月${c.birthdayDay}日`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function accountLabel(user: Pick<UserRecord, "openId" | "oaOpenId" | "mpSubscribed">) {
  const { openId, oaOpenId } = user;
  const isMock = openId?.startsWith("mock:");
  const hasMp = !!openId && !isMock;
  const hasOa = !!oaOpenId;

  if (isMock)
    return { label: "测试账号", color: "bg-amber-50 text-amber-600", icon: "🧪" };
  if (hasMp && hasOa)
    return { label: "小程序+公众号", color: "bg-blue-50 text-blue-600", icon: "🔗" };
  if (hasMp)
    return { label: "微信小程序", color: "bg-green-50 text-green-600", icon: "📱" };
  if (hasOa)
    return { label: "微信公众号", color: "bg-rose-50 text-rose-600", icon: "📢" };
  return { label: "早期用户", color: "bg-gray-100 text-gray-500", icon: "👤" };
}

// ─── Login page ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (key: string) => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!pw) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/stats`, {
        headers: { "x-admin-key": pw },
      });
      if (!res.ok) {
        setErr("密码错误");
        setLoading(false);
        return;
      }
      onLogin(pw);
    } catch {
      setErr("网络错误，请重试");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img
            src={`${import.meta.env.BASE_URL}images/logo.png`}
            alt="生日通"
            className="w-16 h-16 object-contain rounded-2xl"
          />
          <h1 className="text-2xl font-bold text-gray-900">生日通管理后台</h1>
          <p className="text-sm text-gray-400">Birthday Tracker · Admin</p>
        </div>
        <div className="space-y-4">
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="请输入管理密码"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400"
          />
          {err && <p className="text-xs text-red-500">{err}</p>}
          <button
            onClick={submit}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm transition-colors disabled:opacity-60"
          >
            {loading ? "验证中..." : "进入后台"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WeChat Config Panel ──────────────────────────────────────────────────────
function WechatConfigPanel({ adminKey }: { adminKey: string }) {
  const empty: WechatConfig = {
    oaAppId: "",
    oaAppSecret: "",
    oaAppSecretSet: false,
    oaDomain: "",
    oaAccountName: "",
    serverToken: "",
    mpAppId: "",
    mpAppSecret: "",
    mpAppSecretSet: false,
    h5LoginMode: "mock",
    mpLoginMode: "mock",
  };
  const [config, setConfig] = useState<WechatConfig>(empty);
  const [loading, setLoading] = useState(true);
  const [savingOa, setSavingOa] = useState(false);
  const [savingMp, setSavingMp] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [oaMsg, setOaMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [mpMsg, setMpMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [modeMsg, setModeMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/admin/wechat-config`, {
      headers: { "x-admin-key": adminKey },
    })
      .then((r) => r.json())
      .then((d: WechatConfig) => {
        setConfig(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [adminKey]);

  const putConfig = async (body: Record<string, unknown>) => {
    const res = await fetch(
      `${import.meta.env.BASE_URL}api/admin/wechat-config`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify(body),
      },
    );
    return res.ok;
  };

  const saveMode = async (
    h5: WechatConfig["h5LoginMode"],
    mp: WechatConfig["mpLoginMode"],
  ) => {
    setSavingMode(true);
    setModeMsg(null);
    const ok = await putConfig({ h5LoginMode: h5, mpLoginMode: mp }).catch(
      () => false,
    );
    setModeMsg(
      ok
        ? { ok: true, text: "登录模式已保存" }
        : { ok: false, text: "保存失败" },
    );
    setSavingMode(false);
  };

  // After save, optimistically mark secret as set when user entered a new value
  const saveOaAndRefresh = async () => {
    setSavingOa(true);
    setOaMsg(null);
    const hadNewSecret = !!(
      config.oaAppSecret && !config.oaAppSecret.startsWith("•")
    );
    const ok = await putConfig({
      oaAppId: config.oaAppId,
      oaAppSecret: config.oaAppSecret,
      oaDomain: config.oaDomain,
      oaAccountName: config.oaAccountName,
      serverToken: config.serverToken,
    }).catch(() => false);
    if (ok && hadNewSecret) {
      setConfig((c) => ({ ...c, oaAppSecretSet: true, oaAppSecret: "" }));
    }
    setOaMsg(
      ok
        ? { ok: true, text: "✓ 公众号配置已保存" }
        : { ok: false, text: "保存失败，请重试" },
    );
    setSavingOa(false);
  };

  const saveMpAndRefresh = async () => {
    setSavingMp(true);
    setMpMsg(null);
    const hadNewSecret = !!(
      config.mpAppSecret && !config.mpAppSecret.startsWith("•")
    );
    const ok = await putConfig({
      mpAppId: config.mpAppId,
      mpAppSecret: config.mpAppSecret,
    }).catch(() => false);
    if (ok && hadNewSecret) {
      setConfig((c) => ({ ...c, mpAppSecretSet: true, mpAppSecret: "" }));
    }
    setMpMsg(
      ok
        ? { ok: true, text: "✓ 小程序配置已保存" }
        : { ok: false, text: "保存失败，请重试" },
    );
    setSavingMp(false);
  };

  const oaCallbackUrl = config.oaDomain
    ? `${config.oaDomain}/api/auth/wechat/oauth/callback`
    : "（请先填写域名）";

  const isOaConfigured = !!(
    config.oaAppId &&
    config.oaAppSecretSet &&
    config.oaDomain
  );
  const isMpConfigured = !!(config.mpAppId && config.mpAppSecretSet);

  const SaveBtn = ({
    saving,
    onClick,
    label = "保存配置",
  }: {
    saving: boolean;
    onClick: () => void;
    label?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-5 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
    >
      {saving ? "保存中..." : label}
    </button>
  );

  const Msg = ({ msg }: { msg: { ok: boolean; text: string } | null }) =>
    msg ? (
      <div
        className={`text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
      >
        {msg.text}
      </div>
    ) : null;

  if (loading)
    return (
      <div className="flex items-center gap-2 py-20 justify-center text-gray-400">
        <RefreshCw className="w-4 h-4 animate-spin" /> 加载中...
      </div>
    );

  const wechatSvg = (
    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8.5 11.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3.5-6.5C15.5 2.7 12.9 1 9.9 1 5.6 1 2 4.1 2 8c0 2.1 1 3.9 2.6 5.2l-.6 2.2 2.5-1.3c.9.3 1.9.4 2.9.4.3 0 .6 0 .9-.1-.2-.5-.3-1.1-.3-1.7 0-3.5 3-6.3 6.7-6.3.3 0 .6 0 .9.1-.3-1.3-1.1-2.4-2.1-3.3zm3.5 5.5c-2.8 0-5 1.9-5 4.3 0 2.3 2.2 4.2 5 4.2.6 0 1.2-.1 1.8-.3l1.7.9-.4-1.6c1.2-.9 1.9-2 1.9-3.2.1-2.4-2.2-4.3-5-4.3zm-1.5 3a.7.7 0 1 1-1.4 0 .7.7 0 0 1 1.4 0zm3 0a.7.7 0 1 1-1.4 0 .7.7 0 0 1 1.4 0z" />
    </svg>
  );
  const mockSvg = (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );

  return (
    <div className="space-y-5 max-w-2xl">
      {/* ─── H5 登录方式 ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-blue-100 text-blue-600 text-[10px] flex items-center justify-center font-bold flex-shrink-0">
            H5
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-700">
              H5 网页端登录方式
            </h2>
            <p className="text-xs text-gray-400">选择 H5 前端用于登录的方式</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* mode cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* 公众号登录 */}
            <button
              type="button"
              disabled={savingMode}
              onClick={() => {
                const next = "wechat_oa";
                setConfig((c) => ({ ...c, h5LoginMode: next }));
                saveMode(next, config.mpLoginMode);
              }}
              className={`relative flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all ${
                config.h5LoginMode === "wechat_oa"
                  ? "border-[#07C160] bg-green-50"
                  : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}
            >
              {config.h5LoginMode === "wechat_oa" && (
                <CheckCircle className="absolute top-2.5 right-2.5 w-4 h-4 text-[#07C160]" />
              )}
              <div className="w-9 h-9 rounded-full bg-[#07C160] flex items-center justify-center">
                {wechatSvg}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">
                  微信公众号登录
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  OAuth 2.0 网页授权
                </p>
              </div>
              {config.h5LoginMode === "wechat_oa" && !isOaConfigured && (
                <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                  需完成下方配置
                </span>
              )}
              {config.h5LoginMode === "wechat_oa" && isOaConfigured && (
                <span className="text-[10px] text-green-600 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                  已配置
                </span>
              )}
            </button>

            {/* 测试登录 */}
            <button
              type="button"
              disabled={savingMode}
              onClick={() => {
                const next = "mock";
                setConfig((c) => ({ ...c, h5LoginMode: next }));
                saveMode(next, config.mpLoginMode);
              }}
              className={`relative flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all ${
                config.h5LoginMode === "mock"
                  ? "border-rose-400 bg-rose-50"
                  : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}
            >
              {config.h5LoginMode === "mock" && (
                <CheckCircle className="absolute top-2.5 right-2.5 w-4 h-4 text-rose-500" />
              )}
              <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center">
                {mockSvg}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">测试登录</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  昵称登录，无需微信
                </p>
              </div>
              {config.h5LoginMode === "mock" && (
                <span className="text-[10px] text-rose-500 bg-rose-50 border border-rose-200 rounded px-2 py-0.5">
                  当前模式
                </span>
              )}
            </button>
          </div>

          {/* 测试登录说明 */}
          {config.h5LoginMode === "mock" && (
            <div className="bg-blue-50 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">H5 测试登录说明</p>
              <p>• 输入昵称作为账号标识，同昵称始终对应同一账号</p>
              <p>• 换设备不丢失数据，无需微信即可完整体验</p>
              <p className="text-amber-600 font-medium">
                测试模式不验证微信身份，仅适合开发调试阶段使用
              </p>
            </div>
          )}

          {/* OA 配置表单（仅在选择公众号登录时展示） */}
          {config.h5LoginMode === "wechat_oa" && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  公众号应用配置
                </p>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    isOaConfigured
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {isOaConfigured ? (
                    <>
                      <CheckCircle className="w-3 h-3" /> 已配置
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3" /> 未配置
                    </>
                  )}
                </span>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    AppID（公众号）
                  </label>
                  <input
                    type="text"
                    value={config.oaAppId}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, oaAppId: e.target.value }))
                    }
                    placeholder="wx1234567890abcdef"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    AppSecret（公众号）
                    {config.oaAppSecretSet && (
                      <span className="ml-2 text-xs text-green-600 font-normal">
                        已设置，填新值可覆盖
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={config.oaAppSecret}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, oaAppSecret: e.target.value }))
                    }
                    placeholder={
                      config.oaAppSecretSet
                        ? "••••••••（已设置）"
                        : "请输入 AppSecret"
                    }
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    网站域名
                  </label>
                  <input
                    type="text"
                    value={config.oaDomain}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, oaDomain: e.target.value }))
                    }
                    placeholder="https://yourdomain.com"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    含协议前缀，不含末尾斜杠
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    公众号名称
                  </label>
                  <input
                    type="text"
                    value={config.oaAccountName}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        oaAccountName: e.target.value,
                      }))
                    }
                    placeholder="例如：生日通提醒助手"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    显示在 H5 首页「关注公众号」横幅中
                  </p>
                </div>

                {/* 回调地址 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    OAuth 回调地址（自动生成）
                  </label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-mono text-xs text-gray-700 break-all flex items-start gap-2">
                    <span className="flex-1">{oaCallbackUrl}</span>
                    {config.oaDomain && (
                      <a
                        href={oaCallbackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    在公众号后台「网页授权域名」中填入你的域名即可
                  </p>
                </div>

                <details className="group">
                  <summary className="cursor-pointer text-sm text-rose-500 font-medium select-none list-none flex items-center gap-1">
                    <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                    查看配置步骤
                  </summary>
                  <div className="mt-3 space-y-2.5 text-xs text-gray-600">
                    <div className="flex gap-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 font-bold flex items-center justify-center text-[10px]">
                        1
                      </span>
                      <span>
                        登录微信公众平台 →{" "}
                        <strong>
                          设置与开发 → 公众号设置 → 功能设置 → 网页授权域名
                        </strong>
                        ，添加你的域名并下载验证文件。
                      </span>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 font-bold flex items-center justify-center text-[10px]">
                        2
                      </span>
                      <span>
                        在上方填写
                        AppID、AppSecret、域名和公众号名称后点击保存。
                      </span>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 font-bold flex items-center justify-center text-[10px]">
                        3
                      </span>
                      <span>
                        配置完成后 H5 前端将自动显示微信 OAuth 登录入口。
                      </span>
                    </div>
                  </div>
                </details>

                {/* ── 事件推送（Webhook）配置 ── */}
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    事件推送（关注/取关 通知）
                  </p>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700 space-y-1.5">
                    <p className="font-semibold">配置步骤</p>
                    <p>① 微信公众号后台 → 开发 → 基本配置 → 服务器配置 → 启用</p>
                    <p>② URL 填写：<code className="bg-blue-100 px-1 rounded break-all font-mono">{config.oaDomain ? config.oaDomain.replace(/\/+$/, "") + "/api/auth/wechat/webhook" : "https://你的域名/api/auth/wechat/webhook"}</code></p>
                    <p>③ 自定义 Token 填写任意字符串，与下方保持一致</p>
                    <p>④ 消息加解密方式选择「明文模式」</p>
                    <p className="text-blue-600">配置后：用户关注公众号时系统自动记录 unionId，小程序端可实时检测关注状态。</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      服务器 Token（与微信后台一致）
                    </label>
                    <input
                      type="text"
                      value={config.serverToken}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, serverToken: e.target.value }))
                      }
                      placeholder="例如：birthday2024token"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 font-mono"
                    />
                    <p className="mt-1 text-[11px] text-gray-400">
                      任意英文字母 + 数字组合，长度 3-32 位，与微信后台填写的 Token 相同即可。
                    </p>
                  </div>
                </div>

                <Msg msg={oaMsg} />
                <SaveBtn
                  saving={savingOa}
                  onClick={saveOaAndRefresh}
                  label="保存公众号配置"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── 小程序登录方式 ──────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-purple-100 text-purple-600 text-[10px] flex items-center justify-center font-bold flex-shrink-0">
            MP
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-700">
              微信小程序登录方式
            </h2>
            <p className="text-xs text-gray-400">选择小程序端用于登录的方式</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* mode cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* 小程序登录 */}
            <button
              type="button"
              disabled={savingMode}
              onClick={() => {
                const next = "wechat_mp";
                setConfig((c) => ({ ...c, mpLoginMode: next }));
                saveMode(config.h5LoginMode, next);
              }}
              className={`relative flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all ${
                config.mpLoginMode === "wechat_mp"
                  ? "border-purple-400 bg-purple-50"
                  : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}
            >
              {config.mpLoginMode === "wechat_mp" && (
                <CheckCircle className="absolute top-2.5 right-2.5 w-4 h-4 text-purple-500" />
              )}
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-purple-600"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8.5 11.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3.5-6.5C15.5 2.7 12.9 1 9.9 1 5.6 1 2 4.1 2 8c0 2.1 1 3.9 2.6 5.2l-.6 2.2 2.5-1.3c.9.3 1.9.4 2.9.4.3 0 .6 0 .9-.1-.2-.5-.3-1.1-.3-1.7 0-3.5 3-6.3 6.7-6.3.3 0 .6 0 .9.1-.3-1.3-1.1-2.4-2.1-3.3zm3.5 5.5c-2.8 0-5 1.9-5 4.3 0 2.3 2.2 4.2 5 4.2.6 0 1.2-.1 1.8-.3l1.7.9-.4-1.6c1.2-.9 1.9-2 1.9-3.2.1-2.4-2.2-4.3-5-4.3zm-1.5 3a.7.7 0 1 1-1.4 0 .7.7 0 0 1 1.4 0zm3 0a.7.7 0 1 1-1.4 0 .7.7 0 0 1 1.4 0z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">
                  微信小程序登录
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  wx.login() + jscode2session
                </p>
              </div>
              {config.mpLoginMode === "wechat_mp" && !isMpConfigured && (
                <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                  需完成下方配置
                </span>
              )}
              {config.mpLoginMode === "wechat_mp" && isMpConfigured && (
                <span className="text-[10px] text-green-600 bg-green-50 border border-green-200 rounded px-2 py-0.5">
                  已配置
                </span>
              )}
            </button>

            {/* 测试登录 */}
            <button
              type="button"
              disabled={savingMode}
              onClick={() => {
                const next = "mock";
                setConfig((c) => ({ ...c, mpLoginMode: next }));
                saveMode(config.h5LoginMode, next);
              }}
              className={`relative flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all ${
                config.mpLoginMode === "mock"
                  ? "border-rose-400 bg-rose-50"
                  : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}
            >
              {config.mpLoginMode === "mock" && (
                <CheckCircle className="absolute top-2.5 right-2.5 w-4 h-4 text-rose-500" />
              )}
              <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center">
                {mockSvg}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">测试登录</p>
                <p className="text-xs text-gray-500 mt-0.5">自动生成测试账号</p>
              </div>
              {config.mpLoginMode === "mock" && (
                <span className="text-[10px] text-rose-500 bg-rose-50 border border-rose-200 rounded px-2 py-0.5">
                  当前模式
                </span>
              )}
            </button>
          </div>

          {/* 测试登录说明 */}
          {config.mpLoginMode === "mock" && (
            <div className="bg-purple-50 rounded-lg px-4 py-3 text-xs text-purple-700 space-y-1">
              <p className="font-semibold">小程序测试登录说明</p>
              <p>• 调用 wx.login() 获取 code，用 code 哈希生成唯一 openid</p>
              <p>• 无需填写小程序凭证，开发工具可直接测试</p>
              <p className="text-amber-600 font-medium">
                测试模式不验证微信身份，仅适合开发调试阶段使用
              </p>
            </div>
          )}

          {/* MP 配置表单（仅在选择小程序登录时展示） */}
          {config.mpLoginMode === "wechat_mp" && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  小程序应用配置
                </p>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                    isMpConfigured
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {isMpConfigured ? (
                    <>
                      <CheckCircle className="w-3 h-3" /> 已配置
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3" /> 未配置
                    </>
                  )}
                </span>
              </div>
              <div className="p-4 space-y-4">
                {/* 环境变量覆盖警告 */}
                {(config.mpAppIdSource === "env" || config.mpAppSecretSource === "env") && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 space-y-1">
                    <p className="font-semibold flex items-center gap-1">
                      ⚠️ 检测到环境变量覆盖
                    </p>
                    {config.mpAppIdSource === "env" && (
                      <p>
                        <span className="font-medium">AppID</span> 当前由服务器环境变量 <code className="bg-amber-100 px-1 rounded">WECHAT_MP_APPID</code> 提供，
                        数据库中的值无效。请联系运维人员删除或修正该环境变量后重启服务，再重新保存此处配置。
                      </p>
                    )}
                    {config.mpAppSecretSource === "env" && (
                      <p>
                        <span className="font-medium">AppSecret</span> 当前由服务器环境变量 <code className="bg-amber-100 px-1 rounded">WECHAT_MP_APP_SECRET</code> 提供，
                        数据库中的值无效。
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    AppID（小程序）
                    {config.mpAppIdSource === "env" && (
                      <span className="ml-2 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                        环境变量覆盖中
                      </span>
                    )}
                    {config.mpAppIdSource === "db" && (
                      <span className="ml-2 text-[11px] text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                        ✓ 来自数据库
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={config.mpAppId}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, mpAppId: e.target.value }))
                    }
                    placeholder="wx1234567890abcdef"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 font-mono"
                  />
                  {config.mpAppIdSource === "env" && config.mpAppIdActive && (
                    <p className="mt-1 text-[11px] text-amber-600">
                      当前实际生效：<code className="font-mono">{config.mpAppIdActive}</code>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    AppSecret（小程序）
                    {config.mpAppSecretSource === "env" && (
                      <span className="ml-2 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                        环境变量覆盖中
                      </span>
                    )}
                    {config.mpAppSecretSet && config.mpAppSecretSource !== "env" && (
                      <span className="ml-2 text-xs text-green-600 font-normal">
                        已设置，填新值可覆盖
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={config.mpAppSecret}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, mpAppSecret: e.target.value }))
                    }
                    placeholder={
                      config.mpAppSecretSet
                        ? "••••••••（已设置）"
                        : "请输入小程序 AppSecret"
                    }
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 font-mono"
                  />
                </div>

                <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2.5 text-xs text-purple-700 space-y-1">
                  <p className="font-semibold">登录流程说明</p>
                  <p>① 用户点击登录 → wx.login() 获取临时 code</p>
                  <p>② 后端用 code + AppSecret 换取用户唯一 openid</p>
                  <p className="text-amber-600">
                    ⚠️ 未配置时自动降级为测试模式
                  </p>
                </div>

                <details className="group">
                  <summary className="cursor-pointer text-sm text-rose-500 font-medium select-none list-none flex items-center gap-1">
                    <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
                    查看配置步骤
                  </summary>
                  <div className="mt-3 space-y-2.5 text-xs text-gray-600">
                    <div className="flex gap-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 font-bold flex items-center justify-center text-[10px]">
                        1
                      </span>
                      <span>
                        登录
                        <a
                          href="https://mp.weixin.qq.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-rose-500"
                        >
                          {" "}
                          微信小程序管理后台
                        </a>{" "}
                        → 开发 → 开发管理 → 开发设置，获取 AppID 和 AppSecret。
                      </span>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 font-bold flex items-center justify-center text-[10px]">
                        2
                      </span>
                      <span>
                        在上方填写后保存，小程序将使用真实微信账号认证。
                      </span>
                    </div>
                  </div>
                </details>

                <Msg msg={mpMsg} />
                <SaveBtn
                  saving={savingMp}
                  onClick={saveMpAndRefresh}
                  label="保存小程序配置"
                />
              </div>
            </div>
          )}

          <Msg msg={modeMsg} />
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard Panel ──────────────────────────────────────────────────────────
function DashboardPanel({ adminKey }: { adminKey: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/admin/analytics`,
        { headers: { "x-admin-key": adminKey } },
      );
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  function fmtDate(d: string) {
    const [, m, day] = d.split("-");
    return `${parseInt(m)}/${parseInt(day)}`;
  }

  // Show only every 5th label on the x-axis to avoid crowding
  function tickFormatter(value: string, index: number) {
    return index % 5 === 0 ? fmtDate(value) : "";
  }

  const ov = data?.overview;

  const statCards = ov ? [
    { label: "注册用户", value: ov.totalUsers, sub: `今日 +${ov.newToday}`, color: "bg-rose-50", iconBg: "bg-rose-100", textColor: "text-rose-600", icon: "👥" },
    { label: "本周新增", value: ov.newThisWeek, sub: "近 7 天", color: "bg-sky-50", iconBg: "bg-sky-100", textColor: "text-sky-600", icon: "📈" },
    { label: "关注公众号", value: ov.oaFollowers, sub: `${ov.totalUsers > 0 ? Math.round(ov.oaFollowers / ov.totalUsers * 100) : 0}% 占比`, color: "bg-green-50", iconBg: "bg-green-100", textColor: "text-green-600", icon: "📣" },
    { label: "订阅通知", value: ov.mpSubscribers, sub: "小程序订阅", color: "bg-purple-50", iconBg: "bg-purple-100", textColor: "text-purple-600", icon: "🔔" },
    { label: "生日联系人", value: ov.totalContacts, sub: "全部用户合计", color: "bg-amber-50", iconBg: "bg-amber-100", textColor: "text-amber-600", icon: "🎂" },
    { label: "纪念日/倒计时", value: ov.totalEvents, sub: "事件合计", color: "bg-orange-50", iconBg: "bg-orange-100", textColor: "text-orange-600", icon: "📅" },
    { label: "时间胶囊", value: ov.totalCapsules, sub: "全部胶囊", color: "bg-teal-50", iconBg: "bg-teal-100", textColor: "text-teal-600", icon: "💌" },
    { label: "总录入条数", value: ov.totalContacts + ov.totalEvents + ov.totalCapsules, sub: "生日+事件+胶囊", color: "bg-indigo-50", iconBg: "bg-indigo-100", textColor: "text-indigo-600", icon: "📊" },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">数据仪表盘</h2>
          <p className="text-xs text-gray-400 mt-0.5">实时统计 · 图表数据为近 30 天</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          刷新
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">加载中...</span>
        </div>
      )}

      {data && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statCards.map((s) => (
              <div key={s.label} className={`${s.color} rounded-xl p-4 flex items-center gap-3`}>
                <div className={`w-10 h-10 ${s.iconBg} rounded-xl flex items-center justify-center text-lg flex-shrink-0`}>
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <p className={`text-2xl font-bold ${s.textColor}`}>{s.value.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium truncate">{s.label}</p>
                  <p className="text-xs text-gray-400 truncate">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts row 1: daily users + daily launches */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily new users */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">每日新增用户（近 30 天）</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.dailyUsers} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={tickFormatter} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => [v, "新增用户"]}
                    labelFormatter={(l: string) => fmtDate(l)}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="count" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Daily app launches */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">每日启动次数（近 30 天）</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.dailyLaunches} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={tickFormatter} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => [v, "启动次数"]}
                    labelFormatter={(l: string) => fmtDate(l)}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 mt-2">* 需小程序端埋点上报后才有数据</p>
            </div>
          </div>

          {/* Chart row 2: daily content added (stacked) */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">每日新增内容（近 30 天）</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.dailyContent} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tickFormatter={tickFormatter} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  labelFormatter={(l: string) => fmtDate(l)}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="contacts" name="生日联系人" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="events" name="纪念日/倒计时" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
                <Bar dataKey="capsules" name="时间胶囊" stackId="a" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Users Panel ──────────────────────────────────────────────────────────────
function UsersPanel({ adminKey }: { adminKey: string }) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const load = async (p = page) => {
    setLoading(true);
    setExpanded(new Set()); // collapse rows on page change
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/admin/stats?page=${p}`,
        { headers: { "x-admin-key": adminKey } },
      );
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
  }, [page]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      {data && (
        <div className="grid grid-cols-2 gap-4 max-w-lg">
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {data.totalUsers}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">注册用户总数</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {data.totalEntries ?? (data.totalContacts + data.totalEvents)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                录入总条数
                {(data.totalEvents > 0 || data.totalCapsules > 0) && (
                  <span className="ml-1 text-gray-300">
                    ({data.totalContacts} 生日 · {data.totalEvents} 事件{data.totalCapsules > 0 ? ` · ${data.totalCapsules} 胶囊` : ''})
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            用户列表
            {data && (
              <span className="ml-2 text-gray-400 font-normal">
                共 {data.totalUsers} 名 · 第 {data.page}/{data.totalPages} 页
              </span>
            )}
          </h2>
          <button
            onClick={() => load(page)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 text-xs font-medium transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            刷新
          </button>
        </div>

        {!data ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">加载中...</span>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    用户
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    账号类型
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    录入条数
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    关注公众号
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    最后访问
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    注册时间
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.users.map((user) => {
                  const acct = accountLabel(user);
                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-semibold text-xs flex-shrink-0">
                            {user.nickname.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">
                            {user.nickname}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${acct.color}`}
                        >
                          <span>{acct.icon}</span>
                          {acct.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 text-gray-700 font-medium">
                          <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                          {user.contactCount + (user.eventCount ?? 0) + (user.capsuleCount ?? 0)} 条
                        </span>
                        {((user.eventCount ?? 0) > 0 || (user.capsuleCount ?? 0) > 0) && (
                          <div className="text-xs text-gray-400 mt-0.5 pl-5">
                            {user.contactCount} 生日 · {user.eventCount} 事件{(user.capsuleCount ?? 0) > 0 ? ` · ${user.capsuleCount} 胶囊` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {user.oaOpenId ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                            <span>✓</span> 已关注
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                            未关注
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-400 text-xs">
                        {user.lastAccessAt ? (
                          formatDate(user.lastAccessAt)
                        ) : (
                          <span className="text-gray-300">从未</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-400 text-xs">
                        {formatDate(user.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  第 {(page - 1) * 10 + 1}–
                  {Math.min(page * 10, data.totalUsers)} 条，共{" "}
                  {data.totalUsers} 条
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1 || loading}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    上一页
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 || p === totalPages || Math.abs(p - page) <= 2,
                    )
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                        acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "..." ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-2 py-1.5 text-xs text-gray-400"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setPage(item as number)}
                          disabled={loading}
                          className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                            page === item
                              ? "bg-rose-500 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {item}
                        </button>
                      ),
                    )}

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    下一页
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages || loading}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── ContentConfigPanel ───────────────────────────────────────────────────────
function ContentConfigPanel({ adminKey }: { adminKey: string }) {
  const [terms, setTerms] = useState("");
  const [privacy, setPrivacy] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/admin/content-config`, {
      headers: { "x-admin-key": adminKey },
    })
      .then((r) => r.json())
      .then((d) => {
        setTerms(d.termsOfService ?? "");
        setPrivacy(d.privacyPolicy ?? "");
      })
      .catch(() => setError("加载失败，请刷新重试"))
      .finally(() => setLoading(false));
  }, [adminKey]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/admin/content-config`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            termsOfService: terms,
            privacyPolicy: privacy,
          }),
        },
      );
      if (!res.ok) throw new Error("保存失败");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        加载中…
      </div>
    );

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header info card */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-700">
        在此编辑用户协议和隐私政策的正文内容。支持换行，用户点击登录页底部链接时将弹窗展示对应内容。
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Terms of Service */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">用户协议</h3>
        </div>
        <div className="p-6">
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={12}
            placeholder={
              "请输入用户协议内容…\n\n例如：\n第一条 服务说明\n本应用仅供个人使用…"
            }
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-3 resize-y leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent placeholder:text-gray-300"
          />
          <p className="mt-2 text-xs text-gray-400 text-right">
            {terms.length} 字
          </p>
        </div>
      </div>

      {/* Privacy Policy */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">隐私政策</h3>
        </div>
        <div className="p-6">
          <textarea
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value)}
            rows={12}
            placeholder={
              "请输入隐私政策内容…\n\n例如：\n一、信息收集\n本应用会收集您的生日联系人信息…"
            }
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-3 resize-y leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent placeholder:text-gray-300"
          />
          <p className="mt-2 text-xs text-gray-400 text-right">
            {privacy.length} 字
          </p>
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? "保存中…" : "保存内容"}
        </button>
        {saved && (
          <div className="flex items-center gap-1.5 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            已保存
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AiConfigPanel ────────────────────────────────────────────────────────────
interface AiConfig {
  enabled:        boolean;
  provider:       string;
  model:          string;
  apiKeySet:      boolean;
  temperature:    number;
  filterKeywords: string[];
}

const PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    models: ["deepseek-chat", "deepseek-reasoner"],
    docsUrl: "https://platform.deepseek.com",
    color: "bg-blue-500",
  },
];

// ─── FortuneAiSubPanel ────────────────────────────────────────────────────────
function FortuneAiSubPanel({ adminKey }: { adminKey: string }) {
  const FORTUNE_MODELS = ["deepseek-chat", "deepseek-reasoner"];
  const [model, setModel] = useState("deepseek-chat");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/admin/fortune-config`, {
      headers: { "x-admin-key": adminKey },
    })
      .then((r) => r.json())
      .then((d: { model: string; apiKeySet: boolean }) => {
        setModel(d.model ?? "deepseek-chat");
        setApiKeySet(d.apiKeySet);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [adminKey]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/fortune-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ model, apiKey }),
      });
      if (res.ok) {
        setSaveMsg({ ok: true, text: "保存成功" });
        if (apiKey) { setApiKeySet(true); setApiKey(""); }
      } else {
        setSaveMsg({ ok: false, text: "保存失败" });
      }
    } catch {
      setSaveMsg({ ok: false, text: "网络错误" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/fortune-test`, {
        method: "POST",
        headers: { "x-admin-key": adminKey },
      });
      const data = await res.json() as { ok?: boolean; message?: string; error?: string };
      setTestMsg(data.ok !== false
        ? { ok: true, text: data.message ?? "连接成功" }
        : { ok: false, text: data.message ?? data.error ?? "连接失败" });
    } catch {
      setTestMsg({ ok: false, text: "网络错误" });
    } finally {
      setTesting(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center gap-2 py-20 justify-center text-gray-400">
        <RefreshCw className="w-4 h-4 animate-spin" /> 加载中...
      </div>
    );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 模型选择 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">AI 模型</h2>
          <p className="text-xs text-gray-400 mt-0.5">用于微信小程序「今日运势」生成的模型</p>
        </div>
        <div className="p-6 space-y-4">
          {/* Provider card */}
          <div className="flex items-center gap-4 px-4 py-4 rounded-xl border-2 border-rose-400 bg-rose-50">
            <CheckCircle className="absolute hidden" />
            <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">DeepSeek</p>
              <p className="text-xs text-gray-500 mt-0.5">platform.deepseek.com</p>
            </div>
            <CheckCircle className="ml-auto w-4 h-4 text-rose-500" />
          </div>

          {/* 模型版本 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">模型版本</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 font-mono"
            >
              {FORTUNE_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* API Key */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">API Key</h2>
            <p className="text-xs text-gray-400 mt-0.5">运势专属 Key；留空时自动使用「历史事件」的 Key</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${apiKeySet ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-600"}`}>
            {apiKeySet ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {apiKeySet ? "已配置" : "未配置"}
          </span>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              DeepSeek API Key
              {apiKeySet && <span className="ml-2 text-xs text-green-600 font-normal">（已设置，输入新值可覆盖）</span>}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={apiKeySet ? "••••••••（已设置）" : "sk-xxxxxxxxxxxxxxxx"}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 font-mono"
            />
            <p className="mt-1.5 text-xs text-gray-400">
              在 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">platform.deepseek.com</a> 获取 API Key
            </p>
          </div>

          {saveMsg && (
            <div className={`text-sm px-3 py-2 rounded-lg ${saveMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {saveMsg.text}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </div>

      {/* 连通性测试 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">连通性测试</h2>
          <p className="text-xs text-gray-400 mt-0.5">验证 API Key 和模型配置是否可用</p>
        </div>
        <div className="p-6 space-y-4">
          {testMsg && (
            <div className={`flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg ${testMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {testMsg.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {testMsg.text}
            </div>
          )}
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {testing ? "测试中..." : "测试连接"}
          </button>
        </div>
      </div>

      {/* 说明 */}
      <div className="bg-rose-50 border border-rose-100 rounded-xl p-5 text-sm text-rose-700 space-y-2">
        <p className="font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4" />功能说明</p>
        <ul className="space-y-1.5 list-disc list-inside text-rose-600 text-xs">
          <li>微信小程序「我的」页面可进入今日运势，选择星座后调用 DeepSeek 生成</li>
          <li>返回总运、爱情 / 事业 / 财运 / 健康四维指数、穿搭推荐和今日小贴士</li>
          <li>此处 API Key 优先级高于「历史事件 AI」的 Key，留空则自动共用后者</li>
        </ul>
      </div>
    </div>
  );
}

// ─── AiConfigPanel ────────────────────────────────────────────────────────────
function AiConfigPanel({ adminKey }: { adminKey: string }) {
  const [subTab, setSubTab] = useState<"history" | "fortune">("history");
  const [cfg, setCfg] = useState<AiConfig>({
    enabled: true,
    provider: "deepseek",
    model: "deepseek-chat",
    apiKeySet: false,
    temperature: 0.3,
    filterKeywords: [],
  });
  const [apiKey, setApiKey] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/admin/ai-config`, {
      headers: { "x-admin-key": adminKey },
    })
      .then((r) => r.json())
      .then((d: AiConfig) => {
        setCfg({ ...d, filterKeywords: Array.isArray(d.filterKeywords) ? d.filterKeywords : [] });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [adminKey]);

  const currentProvider =
    PROVIDERS.find((p) => p.id === cfg.provider) ?? PROVIDERS[0];

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/admin/ai-config`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({
            enabled: cfg.enabled,
            provider: cfg.provider,
            model: cfg.model,
            apiKeyCustom: apiKey,
            temperature: cfg.temperature,
            filterKeywords: cfg.filterKeywords,
          }),
        },
      );
      if (res.ok) {
        setSaveMsg({ ok: true, text: "保存成功" });
        if (apiKey) setCfg((c) => ({ ...c, apiKeySet: true }));
        setApiKey("");
      } else {
        setSaveMsg({ ok: false, text: "保存失败" });
      }
    } catch {
      setSaveMsg({ ok: false, text: "网络错误" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/ai-test`, {
        method: "POST",
        headers: { "x-admin-key": adminKey },
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (res.ok && data.ok !== false) {
        setTestMsg({ ok: true, text: data.message ?? "连接成功" });
      } else {
        setTestMsg({
          ok: false,
          text: data.message ?? data.error ?? "连接失败",
        });
      }
    } catch {
      setTestMsg({ ok: false, text: "网络错误" });
    } finally {
      setTesting(false);
    }
  };

  if (loading && subTab === "history")
    return (
      <div className="flex items-center gap-2 py-20 justify-center text-gray-400">
        <RefreshCw className="w-4 h-4 animate-spin" /> 加载中...
      </div>
    );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── 子 Tab 切换 ── */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setSubTab("history")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            subTab === "history"
              ? "bg-white text-violet-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          🎂 历史事件 AI
        </button>
        <button
          type="button"
          onClick={() => setSubTab("fortune")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            subTab === "fortune"
              ? "bg-white text-rose-600 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          🔮 今日运势 AI
        </button>
      </div>

      {subTab === "fortune" && <FortuneAiSubPanel adminKey={adminKey} />}

      {subTab === "history" && <Fragment>
      {/* ── 开关 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                AI 历史事件生成
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                为每位联系人的生日日期生成当天历史大事
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCfg((c) => ({ ...c, enabled: !c.enabled }))}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${cfg.enabled ? "bg-violet-500" : "bg-gray-200"}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${cfg.enabled ? "translate-x-5" : "translate-x-0"}`}
            />
          </button>
        </div>
      </div>

      {/* ── AI 模型选择 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">AI 模型供应商</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            选择用于生成历史事件的 AI 服务商
          </p>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid gap-3">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() =>
                  setCfg((c) => ({
                    ...c,
                    provider: provider.id,
                    model: provider.models[0],
                  }))
                }
                className={`relative flex items-center gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all ${
                  cfg.provider === provider.id
                    ? "border-violet-400 bg-violet-50"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300"
                }`}
              >
                {cfg.provider === provider.id && (
                  <CheckCircle className="absolute top-3 right-3 w-4 h-4 text-violet-500" />
                )}
                <div
                  className={`w-10 h-10 rounded-xl ${provider.color} flex items-center justify-center flex-shrink-0`}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {provider.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {provider.docsUrl}
                  </p>
                </div>
              </button>
            ))}

            {/* Future providers hint */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                +
              </div>
              更多模型敬请期待（ChatGPT、Claude…）
            </div>
          </div>

          {/* Model selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              模型版本
            </label>
            <select
              value={cfg.model}
              onChange={(e) => setCfg((c) => ({ ...c, model: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 font-mono"
            >
              {currentProvider.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── API Key ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">API Key</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              留空则使用系统环境变量中配置的默认 Key
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.apiKeySet ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-600"}`}
          >
            {cfg.apiKeySet ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            {cfg.apiKeySet ? "已配置" : "未配置"}
          </span>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              自定义 API Key
              {cfg.apiKeySet && (
                <span className="ml-2 text-xs text-green-600 font-normal">
                  （已设置，输入新值可覆盖）
                </span>
              )}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                cfg.apiKeySet ? "••••••••（已设置）" : "sk-xxxxxxxxxxxxxxxx"
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 font-mono"
            />
            <p className="mt-1.5 text-xs text-gray-400">
              在{" "}
              <a
                href={currentProvider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-600"
              >
                {currentProvider.docsUrl}
              </a>{" "}
              获取 API Key
            </p>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              生成温度{" "}
              <span className="font-mono text-violet-600 ml-1">
                {cfg.temperature.toFixed(1)}
              </span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={cfg.temperature}
              onChange={(e) =>
                setCfg((c) => ({
                  ...c,
                  temperature: parseFloat(e.target.value),
                }))
              }
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0.0 保守（更准确）</span>
              <span>1.0 创意（更多样）</span>
            </div>
          </div>

          {saveMsg && (
            <div
              className={`text-sm px-3 py-2 rounded-lg ${saveMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
            >
              {saveMsg.text}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </div>

      {/* ── 连通性测试 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">连通性测试</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            发送一条测试请求，验证 API Key 和模型配置是否正确
          </p>
        </div>
        <div className="p-6 space-y-4">
          {testMsg && (
            <div
              className={`flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg ${testMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}
            >
              {testMsg.ok ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              {testMsg.text}
            </div>
          )}
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {testing ? "测试中..." : "测试连接"}
          </button>
        </div>
      </div>

      {/* ── 过滤关键词 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">内容过滤关键词</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            含有以下关键词的历史事件将被过滤，不会展示给用户
          </p>
        </div>
        <div className="p-6 space-y-4">
          {/* 现有标签 */}
          <div className="flex flex-wrap gap-2 min-h-[40px]">
            {cfg.filterKeywords.length === 0 && (
              <span className="text-xs text-gray-400">加载中或使用系统默认过滤词...</span>
            )}
            {cfg.filterKeywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-medium border border-red-100"
              >
                {kw}
                <button
                  type="button"
                  onClick={() => setCfg(c => ({ ...c, filterKeywords: c.filterKeywords.filter(k => k !== kw) }))}
                  className="ml-0.5 hover:text-red-800 transition-colors leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          {/* 新增关键词输入 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && newKeyword.trim()) {
                  const kw = newKeyword.trim();
                  if (!cfg.filterKeywords.includes(kw)) {
                    setCfg(c => ({ ...c, filterKeywords: [...c.filterKeywords, kw] }));
                  }
                  setNewKeyword("");
                }
              }}
              placeholder="输入关键词，按 Enter 添加"
              className="flex-1 px-3.5 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
            />
            <button
              type="button"
              onClick={() => {
                const kw = newKeyword.trim();
                if (kw && !cfg.filterKeywords.includes(kw)) {
                  setCfg(c => ({ ...c, filterKeywords: [...c.filterKeywords, kw] }));
                }
                setNewKeyword("");
              }}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold transition-colors"
            >
              + 添加
            </button>
          </div>
          <p className="text-xs text-gray-400">
            修改后点击「保存配置」生效。过滤同时作用于 AI 提示词和后端校验，双重拦截。
          </p>
        </div>
      </div>

      {/* ── 说明 ── */}
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-5 text-sm text-violet-700 space-y-2">
        <p className="font-semibold flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          功能说明
        </p>
        <ul className="space-y-1.5 list-disc list-inside text-violet-600 text-xs">
          <li>
            添加联系人时，系统会自动调用 AI
            生成该日期（月/日）历史上发生的重大事件
          </li>
          <li>
            生成内容横跨古代到现代，包含中国和世界两类事件，在联系人详情页展示
          </li>
          <li>用户也可以在联系人详情页手动点击刷新，重新生成历史事件</li>
          <li>
            当前使用 DeepSeek 模型，系统已内置 API Key，无需额外配置即可使用
          </li>
        </ul>
      </div>
      </Fragment>}
    </div>
  );
}

// ─── NotifyConfigPanel ────────────────────────────────────────────────────────
interface NotifyConfig {
  enabled:        boolean;
  daysBefore:     number[];
  sendHour:       number;
  templateId:     string;
  h5Url:          string;
  mpLinkEnabled:  boolean;
  mpLinkAppId:    string;
  mpLinkPagePath: string;
  lastRunAt:      string | null;
  lastRunResult:  { sent: number; skipped: number; errors: number } | null;
}

interface MpNotifyConfig {
  enabled: boolean;
  templateId: string;
  daysBefore: number[];
  sendHour: number;
  tipText: string;
  lastRunAt: string | null;
  lastRunResult: { sent: number; skipped: number; errors: number } | null;
}

function NotifyConfigPanel({ adminKey }: { adminKey: string }) {
  const BASE = import.meta.env.BASE_URL;
  const H = { "Content-Type": "application/json", "x-admin-key": adminKey };

  const [channel, setChannel] = useState<"oa" | "mp">("oa");
  const [loading, setLoading] = useState(true);

  const [oa, setOa] = useState<NotifyConfig>({
    enabled: false, daysBefore: [1], sendHour: 8,
    templateId: "iKiueM36DMAWXrO4VQMK68ulAFDz_51ylIBZt_AMw9w",
    h5Url: "",
    mpLinkEnabled: false,
    mpLinkAppId: "wx4afbf7c1e3ae97ae",
    mpLinkPagePath: "pages/home/home",
    lastRunAt: null, lastRunResult: null,
  });
  const [oaSaving, setOaSaving] = useState(false);
  const [oaRunning, setOaRunning] = useState(false);
  const [oaSaveMsg, setOaSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [oaRunMsg, setOaRunMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [mp, setMp] = useState<MpNotifyConfig>({
    enabled: false, daysBefore: [1], sendHour: 8,
    templateId: "vpfpK6EUtYVem_oGGaweNmz7C3uQ_9oaG9dbh2H81oQ",
    tipText: "Ta的生日快到了，记得送上生日祝福！",
    lastRunAt: null, lastRunResult: null,
  });
  const [mpSaving, setMpSaving] = useState(false);
  const [mpRunning, setMpRunning] = useState(false);
  const [mpSaveMsg, setMpSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mpRunMsg, setMpRunMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // OA 诊断状态
  interface OaDiag {
    tokenOk: boolean;
    readyToNotify: number;
    totalMp: number;
    withUnionId: number;
    oaOnlyPlaceholders: number;
    lastRunAt: string | null;
    lastResult: { sent: number; skipped: number; errors: number } | null;
  }
  const [oaDiag, setOaDiag] = useState<OaDiag | null>(null);
  const [oaDiagLoading, setOaDiagLoading] = useState(false);
  const [oaSyncing, setOaSyncing] = useState(false);
  const [oaSyncMsg, setOaSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [oaBackfilling, setOaBackfilling] = useState(false);
  const [oaBackfillMsg, setOaBackfillMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadOaDiag = async () => {
    setOaDiagLoading(true);
    try {
      const [diagRes, usersRes] = await Promise.all([
        fetch(`${BASE}api/admin/oa-diagnostic`, { headers: { "x-admin-key": adminKey } }).then(r => r.json()),
        fetch(`${BASE}api/admin/oa-users`, { headers: { "x-admin-key": adminKey } }).then(r => r.json()),
      ]);
      setOaDiag({
        tokenOk: diagRes.accessToken === "OK (obtained)",
        readyToNotify: usersRes.stats?.readyToNotify ?? 0,
        totalMp: usersRes.stats?.realMpUsers ?? 0,
        withUnionId: usersRes.stats?.withUnionId ?? 0,
        oaOnlyPlaceholders: usersRes.stats?.oaOnlyPlaceholders ?? 0,
        lastRunAt: diagRes.lastNotifyRun?.at ?? null,
        lastResult: diagRes.lastNotifyRun?.result ?? null,
      });
    } catch { /* ignore */ }
    setOaDiagLoading(false);
  };

  const runOaSync = async () => {
    setOaSyncing(true); setOaSyncMsg(null);
    try {
      const res = await fetch(`${BASE}api/admin/oa-sync`, { method: "POST", headers: { "x-admin-key": adminKey } });
      const data = await res.json() as { synced?: number; errors?: number; error?: string };
      if (res.ok && !data.error) {
        setOaSyncMsg({ ok: true, text: `同步完成：新关联 ${data.synced} 人，失败 ${data.errors} 条` });
        loadOaDiag(); // 刷新诊断数据
      } else {
        setOaSyncMsg({ ok: false, text: data.error ?? "同步失败" });
      }
    } catch { setOaSyncMsg({ ok: false, text: "网络错误" }); }
    setOaSyncing(false);
  };

  const runOaBackfill = async () => {
    setOaBackfilling(true); setOaBackfillMsg(null);
    try {
      const res = await fetch(`${BASE}api/admin/oa-backfill`, { method: "POST", headers: { "x-admin-key": adminKey } });
      const data = await res.json() as { backfilled?: number; total?: number; error?: string };
      if (res.ok && !data.error) {
        setOaBackfillMsg({ ok: true, text: `回填完成：${data.backfilled} 个用户已关联` });
        loadOaDiag();
      } else {
        setOaBackfillMsg({ ok: false, text: data.error ?? "回填失败" });
      }
    } catch { setOaBackfillMsg({ ok: false, text: "网络错误" }); }
    setOaBackfilling(false);
  };

  const DAY_OPTIONS = [
    { value: 0, label: "生日当天" },
    { value: 1, label: "提前 1 天" },
    { value: 3, label: "提前 3 天" },
    { value: 7, label: "提前 7 天" },
  ];

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${BASE}api/admin/notify-config`, { headers: { "x-admin-key": adminKey } }).then(r => r.json()),
      fetch(`${BASE}api/admin/mp-notify-config`, { headers: { "x-admin-key": adminKey } }).then(r => r.json()),
    ]).then(([oaData, mpData]) => {
      setOa({
        ...oaData,
        mpLinkEnabled:  oaData.mpLinkEnabled  ?? false,
        mpLinkAppId:    oaData.mpLinkAppId    ?? "wx4afbf7c1e3ae97ae",
        mpLinkPagePath: oaData.mpLinkPagePath ?? "pages/home/home",
      } as NotifyConfig);
      setMp(mpData as MpNotifyConfig);
      setLoading(false);
    }).catch(() => setLoading(false));
    // 初始化时自动加载 OA 诊断
    loadOaDiag();
  }, [adminKey]);

  const toggleOaDay = (day: number) => setOa(c => ({
    ...c, daysBefore: c.daysBefore.includes(day)
      ? c.daysBefore.filter(d => d !== day)
      : [...c.daysBefore, day].sort((a, b) => a - b),
  }));

  const toggleMpDay = (day: number) => setMp(c => ({
    ...c, daysBefore: c.daysBefore.includes(day)
      ? c.daysBefore.filter(d => d !== day)
      : [...c.daysBefore, day].sort((a, b) => a - b),
  }));

  const saveOa = async () => {
    setOaSaving(true); setOaSaveMsg(null);
    try {
      const res = await fetch(`${BASE}api/admin/notify-config`, {
        method: "PUT", headers: H,
        body: JSON.stringify({
            enabled: oa.enabled, daysBefore: oa.daysBefore, sendHour: oa.sendHour,
            templateId: oa.templateId, h5Url: oa.h5Url,
            mpLinkEnabled: oa.mpLinkEnabled, mpLinkAppId: oa.mpLinkAppId, mpLinkPagePath: oa.mpLinkPagePath,
          }),
      });
      setOaSaveMsg(res.ok ? { ok: true, text: "✓ 保存成功" } : { ok: false, text: "保存失败" });
    } catch { setOaSaveMsg({ ok: false, text: "网络错误" }); }
    finally { setOaSaving(false); }
  };

  const runOa = async () => {
    setOaRunning(true); setOaRunMsg(null);
    try {
      const res = await fetch(`${BASE}api/admin/notify-run`, { method: "POST", headers: { "x-admin-key": adminKey } });
      const data = await res.json() as { sent?: number; skipped?: number; errors?: number; error?: string };
      if (res.ok && !data.error) {
        setOaRunMsg({ ok: true, text: `完成：发送 ${data.sent} 条，跳过 ${data.skipped} 条，失败 ${data.errors} 条` });
        setOa(c => ({ ...c, lastRunAt: new Date().toISOString(), lastRunResult: { sent: data.sent ?? 0, skipped: data.skipped ?? 0, errors: data.errors ?? 0 } }));
      } else { setOaRunMsg({ ok: false, text: data.error ?? "执行失败" }); }
    } catch { setOaRunMsg({ ok: false, text: "网络错误" }); }
    finally { setOaRunning(false); }
  };

  const saveMp = async () => {
    setMpSaving(true); setMpSaveMsg(null);
    try {
      const res = await fetch(`${BASE}api/admin/mp-notify-config`, {
        method: "PUT", headers: H,
        body: JSON.stringify({ enabled: mp.enabled, daysBefore: mp.daysBefore, sendHour: mp.sendHour, templateId: mp.templateId, tipText: mp.tipText }),
      });
      setMpSaveMsg(res.ok ? { ok: true, text: "✓ 保存成功" } : { ok: false, text: "保存失败" });
    } catch { setMpSaveMsg({ ok: false, text: "网络错误" }); }
    finally { setMpSaving(false); }
  };

  const runMp = async () => {
    setMpRunning(true); setMpRunMsg(null);
    try {
      const res = await fetch(`${BASE}api/admin/mp-notify-run`, { method: "POST", headers: { "x-admin-key": adminKey } });
      const data = await res.json() as { sent?: number; skipped?: number; errors?: number; error?: string };
      if (res.ok && !data.error) {
        setMpRunMsg({ ok: true, text: `完成：发送 ${data.sent} 条，跳过 ${data.skipped} 条，失败 ${data.errors} 条` });
        setMp(c => ({ ...c, lastRunAt: new Date().toISOString(), lastRunResult: { sent: data.sent ?? 0, skipped: data.skipped ?? 0, errors: data.errors ?? 0 } }));
      } else { setMpRunMsg({ ok: false, text: data.error ?? "执行失败" }); }
    } catch { setMpRunMsg({ ok: false, text: "网络错误" }); }
    finally { setMpRunning(false); }
  };

  const MsgBox = ({ msg }: { msg: { ok: boolean; text: string } | null }) =>
    msg ? <div className={`text-sm px-3 py-2 rounded-lg ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</div> : null;

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button type="button" onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? "bg-rose-500" : "bg-gray-200"}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );

  const DayPicker = ({ days, toggle }: { days: number[]; toggle: (d: number) => void }) => (
    <div className="grid grid-cols-2 gap-3">
      {DAY_OPTIONS.map(opt => {
        const checked = days.includes(opt.value);
        return (
          <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left ${checked ? "border-rose-400 bg-rose-50 text-rose-700" : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"}`}>
            <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 ${checked ? "border-rose-500 bg-rose-500" : "border-gray-300"}`}>
              {checked && <CheckCircle className="w-3 h-3 text-white" />}
            </div>
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  const RunRecord = ({ lastRunAt, lastRunResult }: {
    lastRunAt: string | null;
    lastRunResult: { sent: number; skipped: number; errors: number; errorSamples?: Array<{ label: string; errcode?: number; errmsg?: string }> } | null;
  }) => (
    lastRunAt ? (
      <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm space-y-2">
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="w-4 h-4 text-gray-400" />
          <span>上次运行：{new Date(lastRunAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        {lastRunResult && (
          <div className="flex gap-4 text-xs text-gray-500 pl-6">
            <span className="text-green-600">✓ 发送 {lastRunResult.sent} 条</span>
            <span>跳过 {lastRunResult.skipped} 条</span>
            {lastRunResult.errors > 0 && <span className="text-red-500">✗ 失败 {lastRunResult.errors} 条</span>}
          </div>
        )}
        {lastRunResult?.errorSamples && lastRunResult.errorSamples.length > 0 && (
          <div className="mt-1 pl-6 space-y-1">
            {lastRunResult.errorSamples.map((e, i) => (
              <div key={i} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 font-mono">
                [{e.errcode ?? "?"}] {e.errmsg ?? "unknown"} — {e.label}
              </div>
            ))}
          </div>
        )}
      </div>
    ) : <p className="text-sm text-gray-400">暂无运行记录</p>
  );

  if (loading) return (
    <div className="flex items-center gap-2 py-20 justify-center text-gray-400">
      <RefreshCw className="w-4 h-4 animate-spin" /> 加载中...
    </div>
  );

  return (
    <div className="space-y-5 max-w-2xl">

      {/* ── 渠道选择 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">选择通知渠道</h2>
          <p className="text-xs text-gray-400 mt-0.5">选择要配置的通知方式，两种渠道可独立启用</p>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {/* OA 公众号 */}
          <button type="button" onClick={() => setChannel("oa")}
            className={`relative flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all ${channel === "oa" ? "border-[#07C160] bg-green-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"}`}>
            {channel === "oa" && <CheckCircle className="absolute top-2.5 right-2.5 w-4 h-4 text-[#07C160]" />}
            <div className="w-9 h-9 rounded-full bg-[#07C160] flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">公众号模板消息</p>
              <p className="text-xs text-gray-500 mt-0.5">通过服务号发送</p>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${oa.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {oa.enabled ? "已启用" : "未启用"}
            </span>
          </button>

          {/* MP 小程序 */}
          <button type="button" onClick={() => setChannel("mp")}
            className={`relative flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 transition-all ${channel === "mp" ? "border-purple-400 bg-purple-50" : "border-gray-200 bg-gray-50 hover:border-gray-300"}`}>
            {channel === "mp" && <CheckCircle className="absolute top-2.5 right-2.5 w-4 h-4 text-purple-500" />}
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-800">小程序订阅消息</p>
              <p className="text-xs text-gray-500 mt-0.5">用户授权后推送</p>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${mp.enabled ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"}`}>
              {mp.enabled ? "已启用" : "未启用"}
            </span>
          </button>
        </div>
      </div>

      {/* ── 公众号模板消息配置 ── */}
      {channel === "oa" && (
        <>
          {/* ── OA 通知链路诊断卡片 ── */}
          <div className={`rounded-xl border shadow-sm overflow-hidden ${
            oaDiag === null ? "bg-white border-gray-200" :
            !oaDiag.tokenOk ? "bg-red-50 border-red-200" :
            oaDiag.readyToNotify === 0 ? "bg-amber-50 border-amber-200" :
            "bg-green-50 border-green-200"
          }`}>
            <div className="px-6 py-4 border-b border-opacity-20 flex items-center justify-between"
              style={{ borderColor: "inherit" }}>
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${
                  oaDiag === null ? "text-gray-400" :
                  !oaDiag.tokenOk ? "text-red-500" :
                  oaDiag.readyToNotify === 0 ? "text-amber-500" : "text-green-600"
                }`} />
                <h2 className="text-sm font-semibold text-gray-700">通知链路诊断</h2>
              </div>
              <button onClick={loadOaDiag} disabled={oaDiagLoading}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${oaDiagLoading ? "animate-spin" : ""}`} />
                刷新
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {oaDiag === null ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <RefreshCw className="w-4 h-4 animate-spin" /> 加载诊断信息...
                </div>
              ) : (
                <>
                  {/* 状态指标 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className={`rounded-lg px-3 py-2 text-center ${oaDiag.tokenOk ? "bg-green-100" : "bg-red-100"}`}>
                      <p className={`text-lg font-bold ${oaDiag.tokenOk ? "text-green-700" : "text-red-600"}`}>
                        {oaDiag.tokenOk ? "✓" : "✗"}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">AccessToken</p>
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-center ${oaDiag.readyToNotify > 0 ? "bg-green-100" : "bg-amber-100"}`}>
                      <p className={`text-lg font-bold ${oaDiag.readyToNotify > 0 ? "text-green-700" : "text-amber-600"}`}>
                        {oaDiag.readyToNotify}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">可收通知人数</p>
                    </div>
                    <div className="rounded-lg px-3 py-2 text-center bg-gray-100">
                      <p className="text-lg font-bold text-gray-700">{oaDiag.totalMp}</p>
                      <p className="text-xs text-gray-600 mt-0.5">小程序用户数</p>
                    </div>
                  </div>

                  {/* 问题诊断 & 操作指引 */}
                  {!oaDiag.tokenOk && (
                    <div className="bg-red-100 rounded-xl px-4 py-3 space-y-2">
                      <p className="text-sm font-semibold text-red-700">❌ 无法获取公众号 Access Token</p>
                      <p className="text-xs text-red-600">最常见原因：服务器 IP 未加入公众号 IP 白名单</p>
                      <ol className="text-xs text-red-700 space-y-1 list-decimal list-inside">
                        <li>登录微信公众平台 → 设置与开发 → 基本配置</li>
                        <li>在「IP 白名单」中添加服务器公网 IP（可 SSH 后运行 <code className="bg-red-200 px-1 rounded">curl ifconfig.me</code>）</li>
                        <li>保存后等待 1 分钟再刷新此诊断</li>
                      </ol>
                    </div>
                  )}

                  {oaDiag.tokenOk && oaDiag.readyToNotify === 0 && (
                    <div className="bg-amber-100 rounded-xl px-4 py-3 space-y-2">
                      <p className="text-sm font-semibold text-amber-700">⚠️ 还没有用户关联了公众号</p>
                      <p className="text-xs text-amber-700">
                        共 {oaDiag.totalMp} 个小程序用户，其中 {oaDiag.withUnionId} 个有 UnionID，但无人关联 OA
                        {oaDiag.oaOnlyPlaceholders > 0 && `（有 ${oaDiag.oaOnlyPlaceholders} 个公众号关注占位行待匹配）`}
                      </p>
                      <p className="text-xs text-amber-700">点击下方「同步关注者」以自动关联。</p>
                    </div>
                  )}

                  {oaDiag.tokenOk && oaDiag.readyToNotify > 0 && (
                    <div className="bg-green-100 rounded-xl px-4 py-3">
                      <p className="text-sm font-semibold text-green-700">✅ 通知链路正常</p>
                      <p className="text-xs text-green-700 mt-0.5">
                        {oaDiag.readyToNotify} 位用户已关联公众号，将按配置在生日/纪念日前收到通知
                      </p>
                    </div>
                  )}

                  {/* 同步 & 回填按钮 */}
                  {oaDiag.tokenOk && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <button onClick={runOaSync} disabled={oaSyncing}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-60">
                          {oaSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          {oaSyncing ? "同步中..." : "同步关注者（关联 OA）"}
                        </button>
                        {oaSyncMsg && (
                          <span className={`text-xs px-2 py-1 rounded-lg ${oaSyncMsg.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                            {oaSyncMsg.text}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={runOaBackfill} disabled={oaBackfilling}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors disabled:opacity-60">
                          {oaBackfilling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          {oaBackfilling ? "回填中..." : "回填历史登录用户（一键修复）"}
                        </button>
                        {oaBackfillMsg && (
                          <span className={`text-xs px-2 py-1 rounded-lg ${oaBackfillMsg.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                            {oaBackfillMsg.text}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">公众号模板消息通知</h2>
                <p className="text-xs text-gray-400 mt-0.5">通过微信服务号模板消息，在生日前提醒用户</p>
              </div>
              <Toggle checked={oa.enabled} onChange={() => setOa(c => ({ ...c, enabled: !c.enabled }))} />
            </div>
            <div className="px-6 py-4">
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${oa.enabled ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400"}`}>
                <Bell className="w-3.5 h-3.5 flex-shrink-0" />
                {oa.enabled ? "已启用，将按以下配置每天自动发送" : "已关闭，不会向用户发送消息"}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">发送时机</h2>
            </div>
            <div className="p-5 space-y-5">
              <DayPicker days={oa.daysBefore} toggle={toggleOaDay} />
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Clock className="w-4 h-4 text-gray-400" /><span>每天发送时间</span>
                </div>
                <select value={oa.sendHour} onChange={e => setOa(c => ({ ...c, sendHour: parseInt(e.target.value) }))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300">
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">模板消息配置</h2>
              <p className="text-xs text-gray-400 mt-0.5">在公众号后台「功能 → 模板消息」中创建模板，获取模板 ID</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">模板 ID</label>
                <input type="text" value={oa.templateId}
                  onChange={e => setOa(c => ({ ...c, templateId: e.target.value }))}
                  placeholder="例：T1234567890abcdef"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 font-mono" />
              </div>
              {/* 小程序跳转 */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">通知底部跳转小程序</p>
                    <p className="text-xs text-gray-400 mt-0.5">开启后，用户点击通知底部可直接打开小程序首页</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOa(c => ({ ...c, mpLinkEnabled: !c.mpLinkEnabled }))}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${oa.mpLinkEnabled ? "bg-rose-500" : "bg-gray-200"}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${oa.mpLinkEnabled ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                {oa.mpLinkEnabled && (
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">小程序 AppID</label>
                      <input type="text" value={oa.mpLinkAppId}
                        onChange={e => setOa(c => ({ ...c, mpLinkAppId: e.target.value }))}
                        placeholder="wxxxxxxxxxxxxxxxa"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">小程序页面路径</label>
                      <input type="text" value={oa.mpLinkPagePath}
                        onChange={e => setOa(c => ({ ...c, mpLinkPagePath: e.target.value.replace(/\.html$/i, "") }))}
                        placeholder="pages/home/home"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 font-mono" />
                      <p className="mt-1 text-xs text-gray-400">路径不含 <span className="font-mono">.html</span> 后缀，例如 <span className="font-mono">pages/home/home</span></p>
                    </div>
                    <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                      前提：小程序需已在微信开放平台与公众号绑定，且有审核通过的线上版本。否则微信会返回 40165 错误。
                    </p>
                  </div>
                )}
                {!oa.mpLinkEnabled && (
                  <div className="p-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        H5 跳转链接 <span className="text-gray-400 font-normal">（选填，未开启小程序跳转时生效）</span>
                      </label>
                      <input type="url" value={oa.h5Url}
                        onChange={e => setOa(c => ({ ...c, h5Url: e.target.value }))}
                        placeholder="https://your-domain.com/"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 font-mono" />
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs text-gray-500 space-y-1.5">
                <p className="font-semibold text-gray-600">模板变量说明（固定字段）</p>
                <p><span className="font-mono bg-gray-100 px-1 rounded">{"{{thing19.DATA}}"}</span> — 姓名 · 事件类型（如「张伟 · 生日」）</p>
                <p><span className="font-mono bg-gray-100 px-1 rounded">{"{{time24.DATA}}"}</span> — 事件日期时间（如「2026-04-10 08:00」）</p>
              </div>
              <MsgBox msg={oaSaveMsg} />
              <button onClick={saveOa} disabled={oaSaving}
                className="px-5 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {oaSaving ? "保存中..." : "保存配置"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">运行记录</h2>
              <p className="text-xs text-gray-400 mt-0.5">可立即触发一次以测试配置</p>
            </div>
            <div className="p-5 space-y-4">
              <RunRecord lastRunAt={oa.lastRunAt} lastRunResult={oa.lastRunResult} />
              <MsgBox msg={oaRunMsg} />
              <button onClick={runOa} disabled={oaRunning}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {oaRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {oaRunning ? "执行中..." : "立即执行一次"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── 小程序订阅消息配置 ── */}
      {channel === "mp" && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">小程序订阅消息通知</h2>
                <p className="text-xs text-gray-400 mt-0.5">用户在小程序中授权订阅后，可收到生日提醒通知</p>
              </div>
              <Toggle checked={mp.enabled} onChange={() => setMp(c => ({ ...c, enabled: !c.enabled }))} />
            </div>
            <div className="px-6 py-4">
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${mp.enabled ? "bg-purple-50 text-purple-700" : "bg-gray-50 text-gray-400"}`}>
                <Bell className="w-3.5 h-3.5 flex-shrink-0" />
                {mp.enabled ? "已启用，将向已订阅的用户发送生日提醒" : "已关闭，不会向用户发送消息"}
              </div>
              <div className="mt-3 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                用户需在小程序内「设置 → 生日提醒订阅」页面主动授权才会收到消息
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">发送时机</h2>
            </div>
            <div className="p-5 space-y-5">
              <DayPicker days={mp.daysBefore} toggle={toggleMpDay} />
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Clock className="w-4 h-4 text-gray-400" /><span>每天发送时间</span>
                </div>
                <select value={mp.sendHour} onChange={e => setMp(c => ({ ...c, sendHour: parseInt(e.target.value) }))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300">
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">订阅消息模板配置</h2>
              <p className="text-xs text-gray-400 mt-0.5">在小程序后台「订阅消息」中选择并获取模板 ID</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">模板 ID</label>
                <input type="text" value={mp.templateId}
                  onChange={e => setMp(c => ({ ...c, templateId: e.target.value }))}
                  placeholder="vpfpK6EUtYVem_oGGaweNmz7C3uQ_9oaG9dbh2H81oQ"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">温馨提示文案</label>
                <input type="text" value={mp.tipText}
                  onChange={e => setMp(c => ({ ...c, tipText: e.target.value }))}
                  placeholder="Ta的生日快到了，记得送上生日祝福！"
                  maxLength={20}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300" />
                <p className="text-xs text-gray-400 mt-1">对应模板中「温馨提示」字段，最多 20 字</p>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-xs text-purple-700 space-y-1.5">
                <p className="font-semibold">模板字段说明（固定映射）</p>
                <p><span className="font-mono bg-white/60 px-1 rounded">{"{{name1.DATA}}"}</span> — 称呼（联系人姓名）</p>
                <p><span className="font-mono bg-white/60 px-1 rounded">{"{{thing6.DATA}}"}</span> — 生日日期（如「04月15日」）</p>
                <p><span className="font-mono bg-white/60 px-1 rounded">{"{{thing5.DATA}}"}</span> — 温馨提示（上方填写的文案）</p>
              </div>
              <MsgBox msg={mpSaveMsg} />
              <button onClick={saveMp} disabled={mpSaving}
                className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {mpSaving ? "保存中..." : "保存配置"}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">运行记录</h2>
              <p className="text-xs text-gray-400 mt-0.5">可立即触发一次以测试（仅向已订阅用户发送）</p>
            </div>
            <div className="p-5 space-y-4">
              <RunRecord lastRunAt={mp.lastRunAt} lastRunResult={mp.lastRunResult} />
              <MsgBox msg={mpRunMsg} />
              <button onClick={runMp} disabled={mpRunning}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {mpRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {mpRunning ? "执行中..." : "立即执行一次"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── EmailConfigPanel ─────────────────────────────────────────────────────────
interface EmailConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  senderEmail: string;
  authCodeSet: boolean;
  daysBefore: number[];
  sendHour: number;
  lastRunAt: string | null;
  lastRunResult: { sent: number; errors: number } | null;
}

function EmailConfigPanel({ adminKey }: { adminKey: string }) {
  const BASE = import.meta.env.BASE_URL;
  const headers = {
    "Content-Type": "application/json",
    "x-admin-key": adminKey,
  };

  const [cfg, setCfg] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  // Edit state
  const [enabled, setEnabled] = useState(true);
  const [smtpHost, setSmtpHost] = useState("smtp.qq.com");
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [senderEmail, setSenderEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [daysBefore, setDaysBefore] = useState<number[]>([0, 1]);
  const [sendHour, setSendHour] = useState(8);

  // Test email
  const [testEmail, setTestEmail] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testMsg, setTestMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Manual run
  const [runLoading, setRunLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}api/admin/email-config`, { headers });
      if (!r.ok) throw new Error();
      const d: EmailConfig = await r.json();
      setCfg(d);
      setEnabled(d.enabled);
      setSmtpHost(d.smtpHost);
      setSmtpPort(d.smtpPort);
      setSmtpSecure(d.smtpSecure);
      setSenderEmail(d.senderEmail);
      setDaysBefore(d.daysBefore);
      setSendHour(d.sendHour);
    } catch {
      setMsg({ type: "err", text: "加载配置失败" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        enabled,
        smtpHost,
        smtpPort,
        smtpSecure,
        senderEmail,
        daysBefore,
        sendHour,
      };
      if (authCode.trim()) body.authCode = authCode.trim();
      const r = await fetch(`${BASE}api/admin/email-config`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error();
      setMsg({ type: "ok", text: "配置已保存" });
      setAuthCode("");
      await load();
    } catch {
      setMsg({ type: "err", text: "保存失败，请重试" });
    } finally {
      setSaving(false);
    }
  };

  const verify = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await fetch(`${BASE}api/admin/email-verify`, {
        method: "POST",
        headers,
      });
      const d = await r.json();
      setMsg({ type: d.ok ? "ok" : "err", text: d.message });
    } catch {
      setMsg({ type: "err", text: "验证请求失败" });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail.includes("@")) {
      setTestMsg({ type: "err", text: "请输入有效邮箱" });
      return;
    }
    setTestLoading(true);
    setTestMsg(null);
    try {
      const r = await fetch(`${BASE}api/admin/email-test`, {
        method: "POST",
        headers,
        body: JSON.stringify({ toEmail: testEmail }),
      });
      const d = await r.json();
      setTestMsg({ type: d.ok ? "ok" : "err", text: d.message });
    } catch {
      setTestMsg({ type: "err", text: "请求失败" });
    } finally {
      setTestLoading(false);
    }
  };

  const runNow = async () => {
    setRunLoading(true);
    setMsg(null);
    try {
      const r = await fetch(`${BASE}api/admin/email-run`, {
        method: "POST",
        headers,
      });
      const d = await r.json();
      setMsg({
        type: "ok",
        text: `执行完成：发送 ${d.sent} 封，失败 ${d.errors} 封`,
      });
      await load();
    } catch {
      setMsg({ type: "err", text: "执行失败" });
    } finally {
      setRunLoading(false);
    }
  };

  const toggleDay = (d: number) => {
    setDaysBefore((prev) =>
      prev.includes(d)
        ? prev.filter((x) => x !== d)
        : [...prev, d].sort((a, b) => a - b),
    );
  };

  if (loading)
    return <div className="text-center py-20 text-gray-400">加载中…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 全局消息 */}
      {msg && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
            msg.type === "ok"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.type === "ok" ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {msg.text}
        </div>
      )}

      {/* 开关 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled ? "bg-rose-500" : "bg-gray-200"}`}
            >
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">邮件生日提醒</p>
              <p className="text-sm text-gray-400">
                {enabled
                  ? "已开启，按计划自动发送提醒邮件"
                  : "已关闭，不会发送任何邮件"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? "bg-rose-500" : "bg-gray-300"}`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? "left-7" : "left-1"}`}
            />
          </button>
        </div>
      </div>

      {/* SMTP 配置 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-rose-500" /> SMTP 服务器配置
        </h3>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1">
            <label className="text-xs text-gray-500">SMTP 服务器</label>
            <input
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              placeholder="smtp.qq.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">端口</label>
            <input
              type="number"
              value={smtpPort}
              onChange={(e) => setSmtpPort(parseInt(e.target.value) || 465)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSmtpSecure(!smtpSecure)}
            className={`relative w-10 h-5 rounded-full transition-colors ${smtpSecure ? "bg-rose-500" : "bg-gray-300"}`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${smtpSecure ? "left-5" : "left-0.5"}`}
            />
          </button>
          <span className="text-sm text-gray-600">
            启用 SSL/TLS 加密（推荐 QQ 邮箱保持开启）
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500">发件邮箱地址</label>
          <input
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            placeholder="example@qq.com"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500">
            邮箱授权码
            {cfg?.authCodeSet && (
              <span className="ml-2 text-green-600">
                （已设置，留空则保持不变）
              </span>
            )}
          </label>
          <input
            type="password"
            value={authCode}
            onChange={(e) => setAuthCode(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            placeholder={
              cfg?.authCodeSet
                ? "••••••••••••••••"
                : "QQ 邮箱授权码（非登录密码）"
            }
          />
          <p className="text-xs text-gray-400">
            QQ 邮箱需在「设置 → 账户 → POP3/SMTP 服务」处生成授权码
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            保存配置
          </button>
          <button
            onClick={verify}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            验证 SMTP 连接
          </button>
        </div>
      </div>

      {/* 发送时机 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Clock className="w-4 h-4 text-rose-500" /> 发送时机
        </h3>

        <div className="space-y-2">
          <label className="text-xs text-gray-500">
            提前提醒天数（可多选）
          </label>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 3, 7].map((d) => (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  daysBefore.includes(d)
                    ? "bg-rose-50 border-rose-300 text-rose-600"
                    : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {d === 0 ? "当天" : `提前 ${d} 天`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-500">每日发送时间（整点）</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={6}
              max={22}
              value={sendHour}
              onChange={(e) => setSendHour(parseInt(e.target.value))}
              className="flex-1 accent-rose-500"
            />
            <span className="text-sm font-semibold text-rose-600 w-14 text-right">
              {sendHour}:00
            </span>
          </div>
          <p className="text-xs text-gray-400">
            建议设置在早上 8 点，确保用户及时看到提醒
          </p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          保存设置
        </button>
      </div>

      {/* 发送测试邮件 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Send className="w-4 h-4 text-rose-500" /> 发送测试邮件
        </h3>

        {testMsg && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              testMsg.type === "ok"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {testMsg.type === "ok" ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {testMsg.text}
          </div>
        )}

        <div className="flex gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            placeholder="收件邮箱地址"
          />
          <button
            onClick={sendTest}
            disabled={testLoading || !testEmail}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {testLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            发送测试
          </button>
        </div>
        <p className="text-xs text-gray-400">
          发送前请先保存 SMTP 配置，测试邮件将立即送达，不受「发送时机」限制。
        </p>
      </div>

      {/* 手动触发 & 上次运行 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Play className="w-4 h-4 text-rose-500" /> 手动触发 & 运行记录
        </h3>

        {cfg?.lastRunAt && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm space-y-1">
            <p className="text-gray-500">
              上次运行：
              <span className="text-gray-800 font-medium">
                {formatDate(cfg.lastRunAt)}
              </span>
            </p>
            {cfg.lastRunResult && (
              <p className="text-gray-500">
                结果：已发送{" "}
                <span className="text-green-600 font-medium">
                  {cfg.lastRunResult.sent}
                </span>{" "}
                封， 失败{" "}
                <span
                  className={
                    cfg.lastRunResult.errors > 0
                      ? "text-red-600 font-medium"
                      : "text-gray-400"
                  }
                >
                  {cfg.lastRunResult.errors}
                </span>{" "}
                封
              </p>
            )}
          </div>
        )}

        <button
          onClick={runNow}
          disabled={runLoading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {runLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          立即执行一次邮件提醒检查
        </button>
        <p className="text-xs text-gray-400">
          只会向「提前天数」范围内过生日的联系人发送邮件，不会重复发送当天已发的内容。
        </p>
      </div>

      {/* 使用说明 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-400" /> 使用说明
        </h3>
        <div className="space-y-3 text-sm text-gray-500">
          {[
            "在联系人详情页为每位联系人填写「提醒邮箱」，系统将向该邮箱发送生日提醒。",
            "QQ 邮箱需在「账户 → POP3/SMTP 服务」处开启服务并获取授权码，使用授权码而非登录密码。",
            "系统每天在设定时间自动检查当日或即将生日的联系人，并按配置发送邮件提醒。",
            "邮件内容包含联系人姓名、生日、关系、剩余天数等信息，格式精美，支持移动端阅读。",
            "可使用「发送测试邮件」功能验证 SMTP 配置是否正常，测试邮件不会计入正式提醒记录。",
          ].map((text, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── QuotaConfigPanel ─────────────────────────────────────────────────────────
interface QuotaConfig {
  limit: number;
  action: "share" | "video" | "miniprogram";
  perAction: number;
  videoAdId: string;
  mpAppId: string;
  mpPath: string;
  mpName: string;
}

function QuotaConfigPanel({ adminKey }: { adminKey: string }) {
  const [cfg, setCfg] = useState<QuotaConfig>({
    limit: 0,
    action: "share",
    perAction: 5,
    videoAdId: "",
    mpAppId: "",
    mpPath: "",
    mpName: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/admin/quota-config`, {
      headers: { "x-admin-key": adminKey },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: QuotaConfig | null) => {
        if (d) setCfg(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [adminKey]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/quota-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(cfg),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  if (loading)
    return <div className="text-sm text-gray-400 py-8 text-center">加载中…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 说明 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-700 leading-relaxed">
        <p className="font-semibold mb-1">添加配额限制</p>
        <p>
          设置用户免费可添加的生日条数上限，超出后需完成指定操作（分享/看广告/跳转小程序）解锁更多次数。
          条数上限设为 0 则不限制。
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">配额基本设置</h3>
        </div>
        <div className="p-6 space-y-5">
          {/* 免费条数上限 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              免费添加上限（条）
            </label>
            <input
              type="number"
              min={0}
              value={cfg.limit}
              onChange={(e) => setCfg((c) => ({ ...c, limit: parseInt(e.target.value) || 0 }))}
              placeholder="0"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400">填 0 或留空则不限制</p>
          </div>

          {/* 解锁方式 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">解锁方式</label>
            <select
              value={cfg.action}
              onChange={(e) =>
                setCfg((c) => ({ ...c, action: e.target.value as QuotaConfig["action"] }))
              }
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent bg-white"
            >
              <option value="share">分享小程序给好友</option>
              <option value="video">观看视频广告</option>
              <option value="miniprogram">跳转到其他小程序</option>
            </select>
          </div>

          {/* 每次解锁获得条数 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              每次解锁获得条数
            </label>
            <input
              type="number"
              min={1}
              value={cfg.perAction}
              onChange={(e) =>
                setCfg((c) => ({ ...c, perAction: parseInt(e.target.value) || 5 }))
              }
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400">用户每次完成操作后可额外添加的条数</p>
          </div>
        </div>
      </div>

      {/* 视频广告设置 */}
      {cfg.action === "video" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Play className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-800">视频广告设置</h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                激励视频广告位 ID
              </label>
              <input
                type="text"
                value={cfg.videoAdId}
                onChange={(e) => setCfg((c) => ({ ...c, videoAdId: e.target.value }))}
                placeholder="adunit-xxxxxxxxxxxxxxxx"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent font-mono"
              />
              <p className="mt-1 text-xs text-gray-400">
                在微信公众平台流量主 → 广告位管理中创建激励视频广告位，填入广告位 ID
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 跳转小程序设置 */}
      {cfg.action === "miniprogram" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-800">跳转小程序设置</h3>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">目标小程序名称</label>
              <input
                type="text"
                value={cfg.mpName}
                onChange={(e) => setCfg((c) => ({ ...c, mpName: e.target.value }))}
                placeholder="如：某某小程序"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">目标小程序 AppID</label>
              <input
                type="text"
                value={cfg.mpAppId}
                onChange={(e) => setCfg((c) => ({ ...c, mpAppId: e.target.value }))}
                placeholder="wx..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent font-mono"
              />
              <p className="mt-1 text-xs text-gray-400">需要在微信公众平台申请跳转权限</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">跳转页面路径（可选）</label>
              <input
                type="text"
                value={cfg.mpPath}
                onChange={(e) => setCfg((c) => ({ ...c, mpPath: e.target.value }))}
                placeholder="pages/index/index"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* 保存按钮 */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {saving ? "保存中…" : "保存配置"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <CheckCircle className="w-4 h-4" />
            已保存
          </span>
        )}
      </div>
    </div>
  );
}

// ─── ShareConfigPanel ─────────────────────────────────────────────────────────
interface ShareConfig {
  title: string;
  desc: string;
  imgUrl: string;
  link: string;
}

function ShareConfigPanel({ adminKey }: { adminKey: string }) {
  const [cfg, setCfg] = useState<ShareConfig>({
    title: "",
    desc: "",
    imgUrl: "",
    link: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/admin/share-config`, {
      headers: { "x-admin-key": adminKey },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ShareConfig | null) => {
        if (d) setCfg(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [adminKey]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/admin/share-config`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify(cfg),
        },
      );
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="text-sm text-gray-400 py-8 text-center">加载中…</div>
    );

  const previewTitle = cfg.title || "生日通 - 不再错过重要生日";
  const previewDesc = cfg.desc || "智能生日提醒，农历公历都支持";
  const previewImgUrl = cfg.imgUrl || "";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 说明 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-700 leading-relaxed">
        <p className="font-semibold mb-1">微信分享配置</p>
        <p>
          在微信内打开页面时，点击右上角"分享给朋友"或"分享到朋友圈"，会按照下方配置展示分享卡片。需在微信公众号后台完成
          JS-SDK 域名配置后生效。
        </p>
      </div>

      {/* 表单 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Share2 className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">分享卡片内容</h3>
        </div>
        <div className="p-6 space-y-5">
          {/* 标题 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              分享标题
            </label>
            <input
              type="text"
              value={cfg.title}
              onChange={(e) => setCfg((c) => ({ ...c, title: e.target.value }))}
              placeholder="生日通 - 不再错过重要生日"
              maxLength={64}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400">
              留空则使用默认标题（最多 64 字）
            </p>
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              分享描述
            </label>
            <input
              type="text"
              value={cfg.desc}
              onChange={(e) => setCfg((c) => ({ ...c, desc: e.target.value }))}
              placeholder="智能生日提醒，农历公历都支持"
              maxLength={128}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400">
              留空则使用默认描述（最多 128 字）
            </p>
          </div>

          {/* 图片 URL */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              分享缩略图 URL
            </label>
            <input
              type="url"
              value={cfg.imgUrl}
              onChange={(e) =>
                setCfg((c) => ({ ...c, imgUrl: e.target.value }))
              }
              placeholder="https://yourdomain.com/share-thumb.jpg"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400">
              建议 300×300 px 以上的正方形图片，须为可公开访问的 https 链接
            </p>
          </div>

          {/* 分享链接 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              分享链接（落地页）
            </label>
            <input
              type="url"
              value={cfg.link}
              onChange={(e) => setCfg((c) => ({ ...c, link: e.target.value }))}
              placeholder="https://yourdomain.com/birthday-app/"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400">
              留空则默认分享当前页面 URL
            </p>
          </div>
        </div>
      </div>

      {/* 预览 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">分享卡片预览</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            模拟微信「发送给朋友」卡片样式
          </p>
        </div>
        <div className="p-6">
          <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-3 max-w-xs bg-gray-50">
            {previewImgUrl ? (
              <img
                src={previewImgUrl}
                alt=""
                className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-200"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-rose-100 flex-shrink-0 flex items-center justify-center text-rose-400 text-xl">
                🎂
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
                {previewTitle}
              </p>
              <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                {previewDesc}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 保存 */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? "保存中…" : "保存配置"}
        </button>
        {saved && (
          <div className="flex items-center gap-1.5 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            已保存
          </div>
        )}
      </div>

      {/* JS-SDK 域名配置说明 */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-4 text-sm text-amber-800 space-y-2">
        <p className="font-semibold">上线前必做：微信 JS-SDK 域名配置</p>
        <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
          <li>
            登录微信公众平台 →{" "}
            <strong>设置与开发 → 公众号设置 → 功能设置</strong>
          </li>
          <li>
            找到 <strong>「JS接口安全域名」</strong>，添加你的域名（不含
            https://，不含路径）
          </li>
          <li>分享功能仅在微信内置浏览器（公众号 H5）中生效，普通浏览器无效</li>
        </ol>
      </div>
    </div>
  );
}

// ─── MpToolsPanel ─────────────────────────────────────────────────────────────

interface MpTool {
  id: number;
  name: string;
  description: string;
  icon: string;
  type: "internal" | "external";
  path: string;
  app_id: string;
  page_path: string;
  sort_order: number;
  enabled: boolean;
}

const EMPTY_TOOL: Omit<MpTool, "id"> = {
  name: "",
  description: "",
  icon: "🔧",
  type: "internal",
  path: "",
  app_id: "",
  page_path: "",
  sort_order: 0,
  enabled: true,
};

const ICON_SUGGESTIONS = ["🔧","🎂","❤️","⭐","🧮","📅","🎁","🔮","🌈","🎵","🏆","📝","💡","🔔","🌟","🎯","💎","🌺","🎪","🎠"];

function MpToolsPanel({ adminKey }: { adminKey: string }) {
  const [tools, setTools] = useState<MpTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MpTool | null>(null);
  const [form, setForm] = useState<Omit<MpTool, "id">>(EMPTY_TOOL);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [dateCalcEnabled, setDateCalcEnabled] = useState(true);
  const [dateCalcIcon, setDateCalcIcon] = useState<string>("🗓️");
  const [dateCalcIconMode, setDateCalcIconMode] = useState<"emoji" | "image">("emoji");
  const [ageCalcEnabled, setAgeCalcEnabled] = useState(true);
  const [ageCalcIcon, setAgeCalcIcon] = useState<string>("🎂");
  const [ageCalcIconMode, setAgeCalcIconMode] = useState<"emoji" | "image">("emoji");
  const [togglingBuiltin, setTogglingBuiltin] = useState(false);
  const [togglingAgeBuiltin, setTogglingAgeBuiltin] = useState(false);
  const [uploadingBuiltinIcon, setUploadingBuiltinIcon] = useState(false);
  const [savingBuiltinIcon, setSavingBuiltinIcon] = useState(false);
  const [showDateCalcIconEditor, setShowDateCalcIconEditor] = useState(false);
  const [uploadingAgeCalcIcon, setUploadingAgeCalcIcon] = useState(false);
  const [savingAgeCalcIcon, setSavingAgeCalcIcon] = useState(false);
  const [showAgeCalcIconEditor, setShowAgeCalcIconEditor] = useState(false);
  const [iconMode, setIconMode] = useState<"emoji" | "image">("emoji");
  const [uploadingIcon, setUploadingIcon] = useState(false);

  const isIconUrl = (s: string) => s.startsWith("http") || s.startsWith("/api/");

  const API = "/api/mp-tools";
  const headers = { "Content-Type": "application/json", "x-admin-key": adminKey };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/admin`, { headers });
      const data = await r.json();
      setTools(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  const loadBuiltin = async () => {
    try {
      const r = await fetch(`${API}/builtin`);
      const data = await r.json();
      setDateCalcEnabled(data?.date_calc !== false);
      if (data?.date_calc_icon) {
        setDateCalcIcon(data.date_calc_icon);
        setDateCalcIconMode(isIconUrl(data.date_calc_icon) ? "image" : "emoji");
      }
      setAgeCalcEnabled(data?.age_calc !== false);
      if (data?.age_calc_icon) {
        setAgeCalcIcon(data.age_calc_icon);
        setAgeCalcIconMode(isIconUrl(data.age_calc_icon) ? "image" : "emoji");
      }
    } catch { /* default true */ }
  };

  const handleBuiltinIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBuiltinIcon(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch(`${API}/builtin/date_calc/upload-icon`, {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: fd,
      });
      const data = await r.json();
      if (data.url) {
        setDateCalcIcon(data.url);
        setDateCalcIconMode("image");
      }
    } catch { /* ignore */ } finally {
      setUploadingBuiltinIcon(false);
      e.target.value = "";
    }
  };

  const saveBuiltinIcon = async (icon: string) => {
    setSavingBuiltinIcon(true);
    try {
      await fetch(`${API}/builtin/date_calc`, { method: "PUT", headers, body: JSON.stringify({ icon }) });
      setDateCalcIcon(icon);
      setShowDateCalcIconEditor(false);
    } finally {
      setSavingBuiltinIcon(false);
    }
  };

  const toggleAgeCalc = async () => {
    const next = !ageCalcEnabled;
    setAgeCalcEnabled(next);
    setTogglingAgeBuiltin(true);
    try {
      await fetch(`${API}/builtin/age_calc`, { method: "PUT", headers, body: JSON.stringify({ enabled: next }) });
    } finally {
      setTogglingAgeBuiltin(false);
    }
  };

  const handleAgeCalcIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAgeCalcIcon(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch(`${API}/builtin/age_calc/upload-icon`, {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: fd,
      });
      const data = await r.json();
      if (data.url) { setAgeCalcIcon(data.url); setAgeCalcIconMode("image"); }
    } catch { /* ignore */ } finally {
      setUploadingAgeCalcIcon(false);
      e.target.value = "";
    }
  };

  const saveAgeCalcIcon = async (icon: string) => {
    setSavingAgeCalcIcon(true);
    try {
      await fetch(`${API}/builtin/age_calc`, { method: "PUT", headers, body: JSON.stringify({ icon }) });
      setAgeCalcIcon(icon);
      setShowAgeCalcIconEditor(false);
    } finally {
      setSavingAgeCalcIcon(false);
    }
  };

  useEffect(() => {
    void load();
    void loadBuiltin();
  }, []);

  const toggleDateCalc = async () => {
    const next = !dateCalcEnabled;
    setDateCalcEnabled(next);
    setTogglingBuiltin(true);
    try {
      await fetch(`${API}/builtin/date_calc`, { method: "PUT", headers, body: JSON.stringify({ enabled: next }) });
    } finally {
      setTogglingBuiltin(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_TOOL);
    setIconMode("emoji");
    setShowModal(true);
  };

  const openEdit = (t: MpTool) => {
    setEditing(t);
    setForm({ name: t.name, description: t.description, icon: t.icon, type: t.type, path: t.path, app_id: t.app_id, page_path: t.page_path, sort_order: t.sort_order, enabled: t.enabled });
    setIconMode(isIconUrl(t.icon) ? "image" : "emoji");
    setShowModal(true);
  };

  const handleIconFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIcon(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch(`${API}/admin/upload-icon`, {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: fd,
      });
      const data = await r.json();
      if (data.url) setForm((f) => ({ ...f, icon: data.url }));
    } catch { /* ignore */ } finally {
      setUploadingIcon(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url = editing ? `${API}/admin/${editing.id}` : `${API}/admin`;
      const method = editing ? "PUT" : "POST";
      await fetch(url, { method, headers, body: JSON.stringify(form) });
      setShowModal(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确认删除此工具？")) return;
    setDeleting(id);
    try {
      await fetch(`${API}/admin/${id}`, { method: "DELETE", headers });
      await load();
    } finally {
      setDeleting(null);
    }
  };

  const handleToggle = async (t: MpTool) => {
    await fetch(`${API}/admin/${t.id}`, { method: "PUT", headers, body: JSON.stringify({ enabled: !t.enabled }) });
    await load();
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const next = [...tools];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setReordering(true);
    try {
      await fetch(`${API}/admin/reorder`, { method: "PUT", headers, body: JSON.stringify({ ids: next.map((t) => t.id) }) });
      await load();
    } finally {
      setReordering(false);
    }
  };

  const typeBadge = (type: string) =>
    type === "internal"
      ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">内部跳转</span>
      : <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-medium">外部小程序</span>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">小工具配置</h2>
          <p className="text-sm text-gray-500 mt-1">管理微信小程序「小工具」页面展示的工具列表</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加工具
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">加载中…</div>
      ) : tools.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="text-4xl mb-3">🔧</div>
          <p className="text-sm">暂无工具，点击「添加工具」创建第一个</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {tools.map((t, i) => (
            <div key={t.id} className={`flex items-center gap-4 px-5 py-4 border-b border-gray-50 last:border-b-0 ${!t.enabled ? "opacity-50" : ""}`}>
              {/* 排序 */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleMove(i, -1)}
                  disabled={i === 0 || reordering}
                  className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
                  title="上移"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleMove(i, 1)}
                  disabled={i === tools.length - 1 || reordering}
                  className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
                  title="下移"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 图标 */}
              {isIconUrl(t.icon) ? (
                <img src={t.icon} alt="" className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-xl flex-shrink-0">{t.icon}</div>
              )}

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{t.name}</span>
                  {typeBadge(t.type)}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description || "—"}</p>
                <p className="text-[10px] text-gray-300 mt-0.5 truncate font-mono">
                  {t.type === "internal" ? (t.path || "—") : `AppID: ${t.app_id || "—"}`}
                </p>
              </div>

              {/* 开关 */}
              <button
                onClick={() => handleToggle(t)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${t.enabled ? "bg-rose-500" : "bg-gray-200"}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${t.enabled ? "translate-x-4" : "translate-x-0"}`} />
              </button>

              {/* 操作 */}
              <button
                onClick={() => openEdit(t)}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="编辑"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                disabled={deleting === t.id}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 内置工具开关 */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">内置工具管控</h3>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-4">
            {/* 图标（可点击编辑） */}
            <button
              onClick={() => setShowDateCalcIconEditor((v) => !v)}
              className="relative w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-xl flex-shrink-0 hover:ring-2 hover:ring-rose-300 transition-all group"
              title="点击更换图标"
            >
              {isIconUrl(dateCalcIcon) ? (
                <img src={dateCalcIcon} alt="" className="w-11 h-11 rounded-xl object-cover" />
              ) : (
                <span>{dateCalcIcon}</span>
              )}
              <span className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <Pencil className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity" />
              </span>
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">日期计算器</p>
              <p className="text-xs text-gray-400 mt-0.5">计算日期间隔与前后日期</p>
            </div>
            <button
              onClick={toggleDateCalc}
              disabled={togglingBuiltin}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-60 ${dateCalcEnabled ? "bg-rose-500" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${dateCalcEnabled ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>

          {/* 图标编辑展开区 */}
          {showDateCalcIconEditor && (
            <div className="border-t border-gray-100 px-5 py-4 space-y-3">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setDateCalcIconMode("emoji")}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1 ${dateCalcIconMode === "emoji" ? "bg-white text-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <Smile className="w-3 h-3" /> Emoji
                </button>
                <button
                  onClick={() => setDateCalcIconMode("image")}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1 ${dateCalcIconMode === "image" ? "bg-white text-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <Upload className="w-3 h-3" /> 上传图片
                </button>
              </div>

              {dateCalcIconMode === "emoji" ? (
                <div className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    {["🗓️","📅","📆","🗒️","⏰","🕐","📊","🔢","✏️","🧮"].map((ic) => (
                      <button
                        key={ic}
                        onClick={() => setDateCalcIcon(ic)}
                        className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border-2 transition-colors ${dateCalcIcon === ic ? "border-rose-400 bg-rose-50" : "border-gray-100 hover:border-gray-300 bg-gray-50"}`}
                      >{ic}</button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={isIconUrl(dateCalcIcon) ? "" : dateCalcIcon}
                    onChange={(e) => setDateCalcIcon(e.target.value)}
                    placeholder="或直接输入 emoji"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                    maxLength={4}
                  />
                  <button
                    onClick={() => saveBuiltinIcon(isIconUrl(dateCalcIcon) ? "🗓️" : dateCalcIcon)}
                    disabled={savingBuiltinIcon}
                    className="w-full py-2 rounded-xl bg-rose-500 text-white text-sm font-medium disabled:opacity-60"
                  >
                    {savingBuiltinIcon ? "保存中…" : "保存图标"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadingBuiltinIcon ? "border-gray-200 bg-gray-50 cursor-not-allowed" : "border-rose-200 hover:border-rose-400 hover:bg-rose-50"}`}>
                    {uploadingBuiltinIcon ? (
                      <span className="text-sm text-gray-400">上传中…</span>
                    ) : isIconUrl(dateCalcIcon) ? (
                      <img src={dateCalcIcon} alt="" className="h-16 w-16 object-cover rounded-xl" />
                    ) : (
                      <>
                        <Upload className="w-7 h-7 text-rose-300 mb-1" />
                        <span className="text-sm text-gray-400">点击选择图片</span>
                        <span className="text-xs text-gray-300 mt-0.5">JPG / PNG / WebP，最大 5MB</span>
                      </>
                    )}
                    <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleBuiltinIconUpload} disabled={uploadingBuiltinIcon} />
                  </label>
                  {isIconUrl(dateCalcIcon) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveBuiltinIcon(dateCalcIcon)}
                        disabled={savingBuiltinIcon}
                        className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-sm font-medium disabled:opacity-60"
                      >
                        {savingBuiltinIcon ? "保存中…" : "保存图标"}
                      </button>
                      <button
                        onClick={() => { setDateCalcIcon("🗓️"); setDateCalcIconMode("emoji"); }}
                        className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 hover:text-red-500 transition-colors"
                      >
                        移除
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

        {/* 年龄计算器卡片 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mt-3">
          <div className="flex items-center gap-4 px-5 py-4">
            <button
              onClick={() => setShowAgeCalcIconEditor((v) => !v)}
              className="relative w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-xl flex-shrink-0 hover:ring-2 hover:ring-rose-300 transition-all group"
              title="点击更换图标"
            >
              {isIconUrl(ageCalcIcon) ? (
                <img src={ageCalcIcon} alt="" className="w-11 h-11 rounded-xl object-cover" />
              ) : (
                <span>{ageCalcIcon}</span>
              )}
              <span className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <Pencil className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity" />
              </span>
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">年龄计算器</p>
              <p className="text-xs text-gray-400 mt-0.5">生肖星座五行人生阶段一览</p>
            </div>
            <button
              onClick={toggleAgeCalc}
              disabled={togglingAgeBuiltin}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors disabled:opacity-60 ${ageCalcEnabled ? "bg-rose-500" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${ageCalcEnabled ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>

          {showAgeCalcIconEditor && (
            <div className="border-t border-gray-100 px-5 py-4 space-y-3">
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setAgeCalcIconMode("emoji")}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1 ${ageCalcIconMode === "emoji" ? "bg-white text-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <Smile className="w-3 h-3" /> Emoji
                </button>
                <button
                  onClick={() => setAgeCalcIconMode("image")}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1 ${ageCalcIconMode === "image" ? "bg-white text-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <Upload className="w-3 h-3" /> 上传图片
                </button>
              </div>

              {ageCalcIconMode === "emoji" ? (
                <div className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    {["🎂","🎈","🎉","👶","🧒","🧑","👨","👴","🧮","📊","🔢","⏳"].map((ic) => (
                      <button key={ic} onClick={() => setAgeCalcIcon(ic)}
                        className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border-2 transition-colors ${ageCalcIcon === ic ? "border-rose-400 bg-rose-50" : "border-gray-100 hover:border-gray-300 bg-gray-50"}`}
                      >{ic}</button>
                    ))}
                  </div>
                  <input type="text" value={isIconUrl(ageCalcIcon) ? "" : ageCalcIcon}
                    onChange={(e) => setAgeCalcIcon(e.target.value)}
                    placeholder="或直接输入 emoji"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                    maxLength={4} />
                  <button onClick={() => saveAgeCalcIcon(isIconUrl(ageCalcIcon) ? "🎂" : ageCalcIcon)}
                    disabled={savingAgeCalcIcon}
                    className="w-full py-2 rounded-xl bg-rose-500 text-white text-sm font-medium disabled:opacity-60">
                    {savingAgeCalcIcon ? "保存中…" : "保存图标"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadingAgeCalcIcon ? "border-gray-200 bg-gray-50 cursor-not-allowed" : "border-rose-200 hover:border-rose-400 hover:bg-rose-50"}`}>
                    {uploadingAgeCalcIcon ? <span className="text-sm text-gray-400">上传中…</span>
                      : isIconUrl(ageCalcIcon) ? <img src={ageCalcIcon} alt="" className="h-16 w-16 object-cover rounded-xl" />
                      : (<><Upload className="w-7 h-7 text-rose-300 mb-1" /><span className="text-sm text-gray-400">点击选择图片</span><span className="text-xs text-gray-300 mt-0.5">JPG / PNG / WebP，最大 5MB</span></>)}
                    <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleAgeCalcIconUpload} disabled={uploadingAgeCalcIcon} />
                  </label>
                  {isIconUrl(ageCalcIcon) && (
                    <div className="flex gap-2">
                      <button onClick={() => saveAgeCalcIcon(ageCalcIcon)} disabled={savingAgeCalcIcon}
                        className="flex-1 py-2 rounded-xl bg-rose-500 text-white text-sm font-medium disabled:opacity-60">
                        {savingAgeCalcIcon ? "保存中…" : "保存图标"}
                      </button>
                      <button onClick={() => { setAgeCalcIcon("🎂"); setAgeCalcIconMode("emoji"); }}
                        className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 hover:text-red-500 transition-colors">
                        移除
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      {/* 说明 */}
      <div className="mt-4 bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-600 space-y-1">
        <p><strong>内部跳转：</strong>跳转到本小程序页面，填写页面路径，如 <code>/pages/fortune/fortune</code></p>
        <p><strong>外部小程序：</strong>跳转到其他微信小程序，需填写目标小程序 AppID 及页面路径</p>
        <p>上下拖动可调整展示顺序，关闭开关后小程序端不显示该工具</p>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editing ? "编辑工具" : "添加工具"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Icon 选择 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">工具图标</label>
                {/* 模式切换 */}
                <div className="flex gap-1 mb-3 bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setIconMode("emoji")}
                    className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1 ${iconMode === "emoji" ? "bg-white text-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    <Smile className="w-3 h-3" /> Emoji
                  </button>
                  <button
                    onClick={() => setIconMode("image")}
                    className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1 ${iconMode === "image" ? "bg-white text-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    <Upload className="w-3 h-3" /> 上传图片
                  </button>
                </div>

                {iconMode === "emoji" ? (
                  <>
                    <div className="flex gap-2 flex-wrap mb-2">
                      {ICON_SUGGESTIONS.map((ic) => (
                        <button
                          key={ic}
                          onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                          className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border-2 transition-colors ${form.icon === ic ? "border-rose-400 bg-rose-50" : "border-gray-100 hover:border-gray-300 bg-gray-50"}`}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={isIconUrl(form.icon) ? "" : form.icon}
                      onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                      placeholder="或直接输入 emoji"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                      maxLength={4}
                    />
                  </>
                ) : (
                  <div>
                    <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadingIcon ? "border-gray-200 bg-gray-50 cursor-not-allowed" : "border-rose-200 hover:border-rose-400 hover:bg-rose-50"}`}>
                      {uploadingIcon ? (
                        <span className="text-sm text-gray-400">上传中…</span>
                      ) : isIconUrl(form.icon) ? (
                        <img src={form.icon} alt="" className="h-20 w-20 object-cover rounded-xl" />
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-rose-300 mb-2" />
                          <span className="text-sm text-gray-400">点击选择图片</span>
                          <span className="text-xs text-gray-300 mt-1">JPG / PNG / WebP，最大 5MB</span>
                        </>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleIconFileChange}
                        disabled={uploadingIcon}
                      />
                    </label>
                    {isIconUrl(form.icon) && (
                      <button
                        onClick={() => setForm((f) => ({ ...f, icon: "🔧" }))}
                        className="mt-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        移除图片，改用 Emoji
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 名称 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">工具名称 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="如：年龄计算器"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                />
              </div>

              {/* 描述 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">副标题描述</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="如：根据生日计算精确年龄"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                />
              </div>

              {/* 类型 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">跳转类型</label>
                <div className="flex gap-3">
                  {(["internal", "external"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${form.type === t ? "border-rose-400 bg-rose-50 text-rose-600" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                    >
                      {t === "internal" ? "内部跳转" : "外部小程序"}
                    </button>
                  ))}
                </div>
              </div>

              {/* 内部跳转：路径 */}
              {form.type === "internal" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">页面路径 <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={form.path}
                    onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
                    placeholder="/pages/fortune/fortune"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-300"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">小程序内部页面路径，以 / 开头</p>
                </div>
              )}

              {/* 外部小程序 */}
              {form.type === "external" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">目标小程序 AppID <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={form.app_id}
                      onChange={(e) => setForm((f) => ({ ...f, app_id: e.target.value }))}
                      placeholder="wx1234567890abcdef"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">目标页面路径</label>
                    <input
                      type="text"
                      value={form.page_path}
                      onChange={(e) => setForm((f) => ({ ...f, page_path: e.target.value }))}
                      placeholder="pages/index/index"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">目标小程序的页面路径，留空则跳转首页</p>
                  </div>
                </>
              )}

              {/* 状态 */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">启用显示</p>
                  <p className="text-xs text-gray-400">关闭后小程序端不显示此工具</p>
                </div>
                <button
                  onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${form.enabled ? "bg-rose-500" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${form.enabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              {/* 排序 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">排序数值</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))}
                  placeholder="0"
                  min={0}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
                />
                <p className="text-[10px] text-gray-400 mt-1">数值越小越靠前，相同时按创建时间排序</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                className="flex-1 py-2 rounded-lg bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Tab = "dashboard" | "users" | "wechat" | "ai" | "notify" | "email" | "content" | "share" | "mptools" | "quota";

function Dashboard({
  adminKey,
  onLogout,
}: {
  adminKey: string;
  onLogout: () => void;
}) {
  const validTabs: Tab[] = ["dashboard", "users", "wechat", "ai", "notify", "email", "content", "share", "mptools", "quota"];
  const [tab, setTabState] = useState<Tab>(() => {
    const saved = localStorage.getItem(ADMIN_TAB_KEY);
    return saved && validTabs.includes(saved as Tab) ? (saved as Tab) : "dashboard";
  });

  const setTab = (next: Tab) => {
    localStorage.setItem(ADMIN_TAB_KEY, next);
    setTabState(next);
  };

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "仪表盘", icon: <Zap className="w-4 h-4" /> },
    { id: "users", label: "用户管理", icon: <Users className="w-4 h-4" /> },
    { id: "wechat", label: "微信配置", icon: <Settings className="w-4 h-4" /> },
    { id: "ai", label: "AI 模型", icon: <Sparkles className="w-4 h-4" /> },
    { id: "notify", label: "通知配置", icon: <Bell className="w-4 h-4" /> },
    { id: "email", label: "邮件配置", icon: <Mail className="w-4 h-4" /> },
    {
      id: "content",
      label: "协议配置",
      icon: <FileText className="w-4 h-4" />,
    },
    { id: "share", label: "分享配置", icon: <Share2 className="w-4 h-4" /> },
    { id: "mptools", label: "小工具配置", icon: <Wrench className="w-4 h-4" /> },
    { id: "quota", label: "配额限制", icon: <Lock className="w-4 h-4" /> },
  ];

  return (
    <div className="h-screen w-full flex bg-slate-100 font-sans overflow-hidden">
      {/* Sidebar — 固定高度，不随页面滚动 */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto">
        <div className="px-6 py-6 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="生日通"
              className="w-8 h-8 object-contain rounded-lg"
            />
            <div>
              <p className="text-sm font-bold text-gray-900">生日通</p>
              <p className="text-[10px] text-gray-400">管理后台</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === item.id
                  ? "bg-rose-50 text-rose-600"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex-shrink-0 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">
            {navItems.find((n) => n.id === tab)?.label}
          </h1>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </header>

        <div className="flex-1 p-8 overflow-auto">
          {tab === "dashboard" && <DashboardPanel adminKey={adminKey} />}
          {tab === "users" && <UsersPanel adminKey={adminKey} />}
          {tab === "wechat" && <WechatConfigPanel adminKey={adminKey} />}
          {tab === "ai" && <AiConfigPanel adminKey={adminKey} />}
          {tab === "notify" && <NotifyConfigPanel adminKey={adminKey} />}
          {tab === "email" && <EmailConfigPanel adminKey={adminKey} />}
          {tab === "content" && <ContentConfigPanel adminKey={adminKey} />}
          {tab === "share" && <ShareConfigPanel adminKey={adminKey} />}
          {tab === "mptools" && <MpToolsPanel adminKey={adminKey} />}
          {tab === "quota" && <QuotaConfigPanel adminKey={adminKey} />}
        </div>
      </main>
    </div>
  );
}

const ADMIN_SESSION_KEY = "birthday_admin_session";
const ADMIN_TAB_KEY = "birthday_admin_tab";

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Admin() {
  const [adminKey, setAdminKey] = useState<string | null>(() =>
    sessionStorage.getItem(ADMIN_SESSION_KEY),
  );

  const handleLogin = (key: string) => {
    sessionStorage.setItem(ADMIN_SESSION_KEY, key);
    setAdminKey(key);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAdminKey(null);
  };

  if (!adminKey) return <LoginPage onLogin={handleLogin} />;
  return <Dashboard adminKey={adminKey} onLogout={handleLogout} />;
}
