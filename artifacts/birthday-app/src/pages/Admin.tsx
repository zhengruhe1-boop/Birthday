import { useState, useEffect } from "react";
import { Users, CalendarDays, ChevronDown, ChevronRight, RefreshCw, LogOut, Settings, CheckCircle, AlertCircle, ExternalLink, FileText, Bell, Play, Clock, Sparkles, Zap, Mail, Send, ShieldCheck, Share2 } from "lucide-react";

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
  nickname: string;
  avatarUrl: string | null;
  createdAt: string;
  lastAccessAt: string | null;
  contactCount: number;
  contacts: ContactRecord[];
}

interface StatsData {
  totalUsers: number;
  totalContacts: number;
  page: number;
  pageSize: number;
  totalPages: number;
  users: UserRecord[];
}

interface WechatConfig {
  appId: string;
  appSecret: string;
  appSecretSet: boolean;
  domain: string;
  loginMode: "wechat" | "mock";
  accountName: string;
}

function formatBirthday(c: ContactRecord) {
  const cal = c.birthdayLunar ? "农历" : "公历";
  const year = c.birthYear ? `${c.birthYear}年` : "";
  return `${cal} ${year}${c.birthdayMonth}月${c.birthdayDay}日`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function accountLabel(openId: string | null) {
  if (!openId) return { label: "早期用户", color: "bg-gray-100 text-gray-500" };
  if (openId.startsWith("mock:")) return { label: "测试账号", color: "bg-amber-50 text-amber-600" };
  return { label: "微信用户", color: "bg-green-50 text-green-600" };
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
      if (!res.ok) { setErr("密码错误"); setLoading(false); return; }
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
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
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
  const [config, setConfig] = useState<WechatConfig>({ appId: "", appSecret: "", appSecretSet: false, domain: "", loginMode: "mock", accountName: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/admin/wechat-config`, {
      headers: { "x-admin-key": adminKey },
    })
      .then(r => r.json())
      .then((d: WechatConfig) => { setConfig(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [adminKey]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/wechat-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({
          appId:       config.appId,
          appSecret:   config.appSecret,
          domain:      config.domain,
          loginMode:   config.loginMode,
          accountName: config.accountName,
        }),
      });
      setSaveMsg(res.ok ? { ok: true, text: "保存成功" } : { ok: false, text: "保存失败" });
    } catch {
      setSaveMsg({ ok: false, text: "网络错误" });
    } finally {
      setSaving(false);
    }
  };

  const callbackUrl = config.domain
    ? `${config.domain}/api/auth/wechat/oauth/callback`
    : "（请先填写域名）";

  if (loading) return (
    <div className="flex items-center gap-2 py-20 justify-center text-gray-400">
      <RefreshCw className="w-4 h-4 animate-spin" /> 加载中...
    </div>
  );

  const isWechatConfigured = !!(config.appId && config.appSecretSet && config.domain);

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── 登录方式选择 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">登录方式</h2>
          <p className="text-xs text-gray-400 mt-0.5">选择前端登录页向用户展示的登录方式</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-3">
            {/* 微信登录 */}
            <button
              type="button"
              onClick={() => setConfig(c => ({ ...c, loginMode: "wechat" }))}
              className={`relative flex flex-col items-center gap-3 px-4 py-5 rounded-xl border-2 transition-all ${
                config.loginMode === "wechat"
                  ? "border-[#07C160] bg-green-50"
                  : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}
            >
              {config.loginMode === "wechat" && (
                <CheckCircle className="absolute top-3 right-3 w-4 h-4 text-[#07C160]" />
              )}
              <div className="w-10 h-10 rounded-full bg-[#07C160] flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.5 11.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3.5-6.5C15.5 2.7 12.9 1 9.9 1 5.6 1 2 4.1 2 8c0 2.1 1 3.9 2.6 5.2l-.6 2.2 2.5-1.3c.9.3 1.9.4 2.9.4.3 0 .6 0 .9-.1-.2-.5-.3-1.1-.3-1.7 0-3.5 3-6.3 6.7-6.3.3 0 .6 0 .9.1-.3-1.3-1.1-2.4-2.1-3.3zm3.5 5.5c-2.8 0-5 1.9-5 4.3 0 2.3 2.2 4.2 5 4.2.6 0 1.2-.1 1.8-.3l1.7.9-.4-1.6c1.2-.9 1.9-2 1.9-3.2.1-2.4-2.2-4.3-5-4.3zm-1.5 3a.7.7 0 1 1-1.4 0 .7.7 0 0 1 1.4 0zm3 0a.7.7 0 1 1-1.4 0 .7.7 0 0 1 1.4 0z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">微信登录</p>
                <p className="text-xs text-gray-500 mt-0.5">使用微信 OAuth 授权</p>
              </div>
              {!isWechatConfigured && config.loginMode === "wechat" && (
                <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-0.5">需完成微信配置</p>
              )}
            </button>

            {/* 测试登录 */}
            <button
              type="button"
              onClick={() => setConfig(c => ({ ...c, loginMode: "mock" }))}
              className={`relative flex flex-col items-center gap-3 px-4 py-5 rounded-xl border-2 transition-all ${
                config.loginMode === "mock"
                  ? "border-rose-400 bg-rose-50"
                  : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}
            >
              {config.loginMode === "mock" && (
                <CheckCircle className="absolute top-3 right-3 w-4 h-4 text-rose-500" />
              )}
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zm-4 7a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">测试登录</p>
                <p className="text-xs text-gray-500 mt-0.5">昵称登录，无需微信</p>
              </div>
            </button>
          </div>

          <div className={`mt-4 flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs ${
            config.loginMode === "wechat"
              ? "bg-green-50 text-green-700"
              : "bg-rose-50 text-rose-700"
          }`}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {config.loginMode === "wechat"
              ? "前端登录页将显示「微信一键登录」按钮，用户通过微信授权登录"
              : "前端登录页将直接显示测试登录面板，用户无需微信即可使用"}
          </div>
        </div>
      </div>

      {/* ── 微信 OAuth 配置 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">微信公众号配置</h2>
            <p className="text-xs text-gray-400 mt-0.5">需要微信服务号，在公众号后台 → 开发 → 基本配置中获取</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            isWechatConfigured ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-600"
          }`}>
            {isWechatConfigured ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {isWechatConfigured ? "已配置" : "未配置"}
          </span>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">AppID</label>
            <input
              type="text"
              value={config.appId}
              onChange={e => setConfig(c => ({ ...c, appId: e.target.value }))}
              placeholder="wx1234567890abcdef"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              AppSecret
              {config.appSecretSet && (
                <span className="ml-2 text-xs text-green-600 font-normal">（已设置，填新值可覆盖）</span>
              )}
            </label>
            <input
              type="password"
              value={config.appSecret}
              onChange={e => setConfig(c => ({ ...c, appSecret: e.target.value }))}
              placeholder={config.appSecretSet ? "••••••••（已设置）" : "请输入 AppSecret"}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">网站域名（含协议，不含末尾斜杠）</label>
            <input
              type="text"
              value={config.domain}
              onChange={e => setConfig(c => ({ ...c, domain: e.target.value }))}
              placeholder="https://yourdomain.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400"
            />
            <p className="text-xs text-gray-400 mt-1">填写部署后的真实域名，微信会将用户重定向回此地址</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">公众号名称（用于首页关注提示）</label>
            <input
              type="text"
              value={config.accountName}
              onChange={e => setConfig(c => ({ ...c, accountName: e.target.value }))}
              placeholder="例如：生日通提醒助手"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400"
            />
            <p className="text-xs text-gray-400 mt-1">微信用户登录后，首页会出现「关注公众号」提示横幅，此处填写公众号的名称</p>
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
            {saving ? "保存中..." : "保存所有配置"}
          </button>
        </div>
      </div>

      {/* Setup instructions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">配置步骤说明</h2>
        </div>
        <div className="p-6 space-y-4 text-sm text-gray-600">
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center">1</span>
            <p>登录微信公众平台，进入 <strong>设置与开发 → 公众号设置 → 功能设置 → 网页授权域名</strong>，添加你的域名。</p>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center">2</span>
            <p>下载验证文件并放置到网站根目录（或配置服务器返回对应路径）以通过微信域名验证。</p>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center">3</span>
            <p>在上方填写 AppID、AppSecret 和域名后保存。</p>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center">4</span>
            <div>
              <p className="mb-1">OAuth 回调地址（已自动生成，无需手动填写到公众号）：</p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 font-mono text-xs text-gray-700 break-all flex items-start gap-2">
                <span className="flex-1">{callbackUrl}</span>
                {config.domain && (
                  <a href={callbackUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-gray-400 hover:text-gray-600">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center">5</span>
            <p>完成后，前端登录页"微信一键登录"按钮将自动切换为真实微信 OAuth 授权流程。</p>
          </div>
        </div>
      </div>
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

  useEffect(() => { load(page); }, [page]);

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
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
              <p className="text-2xl font-bold text-gray-900">{data.totalUsers}</p>
              <p className="text-xs text-gray-400 mt-0.5">注册用户总数</p>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{data.totalContacts}</p>
              <p className="text-xs text-gray-400 mt-0.5">生日记录总数</p>
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
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
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
                  <th className="px-6 py-3 w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">用户</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">账号类型</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Open ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">生日条数</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">最后访问</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">注册时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.users.map(user => {
                  const acct = accountLabel(user.openId);
                  const isExpanded = expanded.has(user.id);
                  return (
                    <>
                      <tr
                        key={user.id}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => toggleExpand(user.id)}
                      >
                        <td className="px-6 py-4 text-gray-400">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-semibold text-xs flex-shrink-0">
                              {user.nickname.charAt(0)}
                            </div>
                            <span className="font-medium text-gray-900">{user.nickname}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${acct.color}`}>
                            {acct.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-400 font-mono text-xs max-w-40 truncate">{user.openId || "—"}</td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1.5 text-gray-700 font-medium">
                            <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                            {user.contactCount} 条
                          </span>
                        </td>
                        <td className="px-4 py-4 text-gray-400 text-xs">
                          {user.lastAccessAt ? formatDate(user.lastAccessAt) : <span className="text-gray-300">从未</span>}
                        </td>
                        <td className="px-4 py-4 text-gray-400 text-xs">{formatDate(user.createdAt)}</td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${user.id}-detail`} className="bg-slate-50">
                          <td colSpan={7} className="px-12 py-4">
                            {user.contacts.length === 0 ? (
                              <p className="text-sm text-gray-400 py-2">该用户暂无生日记录</p>
                            ) : (
                              <table className="w-full text-sm bg-white rounded-xl overflow-hidden border border-gray-200">
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">姓名</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">生日</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">关系</th>
                                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">添加时间</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {user.contacts.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50">
                                      <td className="px-5 py-3">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 text-[10px] font-bold">
                                            {c.name.charAt(0)}
                                          </div>
                                          <span className="font-medium text-gray-900">{c.name}</span>
                                        </div>
                                      </td>
                                      <td className="px-5 py-3 text-gray-600">{formatBirthday(c)}</td>
                                      <td className="px-5 py-3 text-gray-400">{c.relation || "—"}</td>
                                      <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  第 {(page - 1) * 10 + 1}–{Math.min(page * 10, data.totalUsers)} 条，共 {data.totalUsers} 条
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
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    上一页
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "..." ? (
                        <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-xs text-gray-400">…</span>
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
                      )
                    )}

                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
  const [terms,   setTerms]   = useState("");
  const [privacy, setPrivacy] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/admin/content-config`, {
      headers: { "x-admin-key": adminKey },
    })
      .then(r => r.json())
      .then(d => { setTerms(d.termsOfService ?? ""); setPrivacy(d.privacyPolicy ?? ""); })
      .catch(() => setError("加载失败，请刷新重试"))
      .finally(() => setLoading(false));
  }, [adminKey]);

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/content-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ termsOfService: terms, privacyPolicy: privacy }),
      });
      if (!res.ok) throw new Error("保存失败");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中…</div>
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
            onChange={e => setTerms(e.target.value)}
            rows={12}
            placeholder={"请输入用户协议内容…\n\n例如：\n第一条 服务说明\n本应用仅供个人使用…"}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-3 resize-y leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent placeholder:text-gray-300"
          />
          <p className="mt-2 text-xs text-gray-400 text-right">{terms.length} 字</p>
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
            onChange={e => setPrivacy(e.target.value)}
            rows={12}
            placeholder={"请输入隐私政策内容…\n\n例如：\n一、信息收集\n本应用会收集您的生日联系人信息…"}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg px-4 py-3 resize-y leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent placeholder:text-gray-300"
          />
          <p className="mt-2 text-xs text-gray-400 text-right">{privacy.length} 字</p>
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
  enabled:     boolean;
  provider:    string;
  model:       string;
  apiKeySet:   boolean;
  temperature: number;
}

const PROVIDERS = [
  {
    id:      "deepseek",
    name:    "DeepSeek",
    models:  ["deepseek-chat", "deepseek-reasoner"],
    docsUrl: "https://platform.deepseek.com",
    color:   "bg-blue-500",
  },
];

function AiConfigPanel({ adminKey }: { adminKey: string }) {
  const [cfg, setCfg]     = useState<AiConfig>({ enabled: true, provider: "deepseek", model: "deepseek-chat", apiKeySet: false, temperature: 0.3 });
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [testing, setTesting]   = useState(false);
  const [saveMsg, setSaveMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const [testMsg, setTestMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/admin/ai-config`, {
      headers: { "x-admin-key": adminKey },
    })
      .then(r => r.json())
      .then((d: AiConfig) => { setCfg(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [adminKey]);

  const currentProvider = PROVIDERS.find(p => p.id === cfg.provider) ?? PROVIDERS[0];

  const handleSave = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/ai-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({
          enabled:      cfg.enabled,
          provider:     cfg.provider,
          model:        cfg.model,
          apiKeyCustom: apiKey,
          temperature:  cfg.temperature,
        }),
      });
      if (res.ok) {
        setSaveMsg({ ok: true, text: "保存成功" });
        if (apiKey) setCfg(c => ({ ...c, apiKeySet: true }));
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
    setTesting(true); setTestMsg(null);
    try {
      const res  = await fetch(`${import.meta.env.BASE_URL}api/admin/ai-test`, {
        method: "POST",
        headers: { "x-admin-key": adminKey },
      });
      const data = await res.json() as { ok?: boolean; message?: string; error?: string };
      if (res.ok && data.ok !== false) {
        setTestMsg({ ok: true,  text: data.message ?? "连接成功" });
      } else {
        setTestMsg({ ok: false, text: data.message ?? data.error ?? "连接失败" });
      }
    } catch {
      setTestMsg({ ok: false, text: "网络错误" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center gap-2 py-20 justify-center text-gray-400">
      <RefreshCw className="w-4 h-4 animate-spin" /> 加载中...
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── 开关 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">AI 历史事件生成</h2>
              <p className="text-xs text-gray-400 mt-0.5">为每位联系人的生日日期生成当天历史大事</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCfg(c => ({ ...c, enabled: !c.enabled }))}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${cfg.enabled ? "bg-violet-500" : "bg-gray-200"}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${cfg.enabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      {/* ── AI 模型选择 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">AI 模型供应商</h2>
          <p className="text-xs text-gray-400 mt-0.5">选择用于生成历史事件的 AI 服务商</p>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid gap-3">
            {PROVIDERS.map(provider => (
              <button
                key={provider.id}
                type="button"
                onClick={() => setCfg(c => ({ ...c, provider: provider.id, model: provider.models[0] }))}
                className={`relative flex items-center gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all ${
                  cfg.provider === provider.id
                    ? "border-violet-400 bg-violet-50"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300"
                }`}
              >
                {cfg.provider === provider.id && (
                  <CheckCircle className="absolute top-3 right-3 w-4 h-4 text-violet-500" />
                )}
                <div className={`w-10 h-10 rounded-xl ${provider.color} flex items-center justify-center flex-shrink-0`}>
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{provider.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{provider.docsUrl}</p>
                </div>
              </button>
            ))}

            {/* Future providers hint */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">+</div>
              更多模型敬请期待（ChatGPT、Claude…）
            </div>
          </div>

          {/* Model selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">模型版本</label>
            <select
              value={cfg.model}
              onChange={e => setCfg(c => ({ ...c, model: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 font-mono"
            >
              {currentProvider.models.map(m => (
                <option key={m} value={m}>{m}</option>
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
            <p className="text-xs text-gray-400 mt-0.5">留空则使用系统环境变量中配置的默认 Key</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.apiKeySet ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-600"}`}>
            {cfg.apiKeySet ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {cfg.apiKeySet ? "已配置" : "未配置"}
          </span>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              自定义 API Key
              {cfg.apiKeySet && <span className="ml-2 text-xs text-green-600 font-normal">（已设置，输入新值可覆盖）</span>}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={cfg.apiKeySet ? "••••••••（已设置）" : "sk-xxxxxxxxxxxxxxxx"}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 font-mono"
            />
            <p className="mt-1.5 text-xs text-gray-400">
              在 <a href={currentProvider.docsUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">{currentProvider.docsUrl}</a> 获取 API Key
            </p>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              生成温度 <span className="font-mono text-violet-600 ml-1">{cfg.temperature.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={cfg.temperature}
              onChange={e => setCfg(c => ({ ...c, temperature: parseFloat(e.target.value) }))}
              className="w-full accent-violet-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0.0 保守（更准确）</span>
              <span>1.0 创意（更多样）</span>
            </div>
          </div>

          {saveMsg && (
            <div className={`text-sm px-3 py-2 rounded-lg ${saveMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
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
          <p className="text-xs text-gray-400 mt-0.5">发送一条测试请求，验证 API Key 和模型配置是否正确</p>
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

      {/* ── 说明 ── */}
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-5 text-sm text-violet-700 space-y-2">
        <p className="font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4" />功能说明</p>
        <ul className="space-y-1.5 list-disc list-inside text-violet-600 text-xs">
          <li>添加联系人时，系统会自动调用 AI 生成该日期（月/日）历史上发生的重大事件</li>
          <li>生成内容横跨古代到现代，包含中国和世界两类事件，在联系人详情页展示</li>
          <li>用户也可以在联系人详情页手动点击刷新，重新生成历史事件</li>
          <li>当前使用 DeepSeek 模型，系统已内置 API Key，无需额外配置即可使用</li>
        </ul>
      </div>
    </div>
  );
}

// ─── NotifyConfigPanel ────────────────────────────────────────────────────────
interface NotifyConfig {
  enabled:       boolean;
  daysBefore:    number[];
  sendHour:      number;
  templateId:    string;
  lastRunAt:     string | null;
  lastRunResult: { sent: number; skipped: number; errors: number } | null;
}

function NotifyConfigPanel({ adminKey }: { adminKey: string }) {
  const [cfg, setCfg] = useState<NotifyConfig>({
    enabled: false, daysBefore: [1], sendHour: 8,
    templateId: "iKiueM36DMAWXrO4VQMK68ulAFDz_51ylIBZt_AMw9w",
    lastRunAt: null, lastRunResult: null,
  });
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [running, setRunning]   = useState(false);
  const [saveMsg, setSaveMsg]   = useState<{ ok: boolean; text: string } | null>(null);
  const [runMsg,  setRunMsg]    = useState<{ ok: boolean; text: string } | null>(null);

  const DAY_OPTIONS = [
    { value: 0, label: "生日当天" },
    { value: 1, label: "提前 1 天" },
    { value: 3, label: "提前 3 天" },
    { value: 7, label: "提前 7 天" },
  ];

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/admin/notify-config`, {
      headers: { "x-admin-key": adminKey },
    })
      .then(r => r.json())
      .then((d: NotifyConfig) => { setCfg(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [adminKey]);

  const toggleDay = (day: number) => {
    setCfg(c => ({
      ...c,
      daysBefore: c.daysBefore.includes(day)
        ? c.daysBefore.filter(d => d !== day)
        : [...c.daysBefore, day].sort((a, b) => a - b),
    }));
  };

  const handleSave = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/notify-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({
          enabled:    cfg.enabled,
          daysBefore: cfg.daysBefore,
          sendHour:   cfg.sendHour,
          templateId: cfg.templateId,
        }),
      });
      setSaveMsg(res.ok ? { ok: true, text: "保存成功" } : { ok: false, text: "保存失败" });
    } catch {
      setSaveMsg({ ok: false, text: "网络错误" });
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    setRunning(true); setRunMsg(null);
    try {
      const res  = await fetch(`${import.meta.env.BASE_URL}api/admin/notify-run`, {
        method: "POST",
        headers: { "x-admin-key": adminKey },
      });
      const data = await res.json() as { sent?: number; skipped?: number; errors?: number; error?: string };
      if (res.ok && data.error === undefined) {
        setRunMsg({ ok: true, text: `完成：发送 ${data.sent} 条，跳过 ${data.skipped} 条，失败 ${data.errors} 条` });
        setCfg(c => ({ ...c, lastRunAt: new Date().toISOString(), lastRunResult: { sent: data.sent ?? 0, skipped: data.skipped ?? 0, errors: data.errors ?? 0 } }));
      } else {
        setRunMsg({ ok: false, text: data.error ?? "执行失败" });
      }
    } catch {
      setRunMsg({ ok: false, text: "网络错误" });
    } finally {
      setRunning(false);
    }
  };

  if (loading) return (
    <div className="flex items-center gap-2 py-20 justify-center text-gray-400">
      <RefreshCw className="w-4 h-4 animate-spin" /> 加载中...
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── 开关 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">公众号生日消息通知</h2>
            <p className="text-xs text-gray-400 mt-0.5">通过微信公众号模板消息，在生日前提醒用户</p>
          </div>
          <button
            type="button"
            onClick={() => setCfg(c => ({ ...c, enabled: !c.enabled }))}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${cfg.enabled ? "bg-rose-500" : "bg-gray-200"}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${cfg.enabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
        <div className="px-6 py-4">
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${cfg.enabled ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400"}`}>
            <Bell className="w-3.5 h-3.5 flex-shrink-0" />
            {cfg.enabled ? "通知已启用，将按以下配置每天自动发送" : "通知已关闭，不会向用户发送任何消息"}
          </div>
        </div>
      </div>

      {/* ── 发送时机 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">发送时机</h2>
          <p className="text-xs text-gray-400 mt-0.5">选择在生日哪几天发送提醒（可多选）</p>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {DAY_OPTIONS.map(opt => {
              const checked = cfg.daysBefore.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleDay(opt.value)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left ${
                    checked
                      ? "border-rose-400 bg-rose-50 text-rose-700"
                      : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 ${checked ? "border-rose-500 bg-rose-500" : "border-gray-300"}`}>
                    {checked && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>每天发送时间</span>
            </div>
            <select
              value={cfg.sendHour}
              onChange={e => setCfg(c => ({ ...c, sendHour: parseInt(e.target.value) }))}
              className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── 模板消息配置 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">模板消息配置</h2>
          <p className="text-xs text-gray-400 mt-0.5">在公众号后台「功能 → 模板消息」中创建模板后，将 ID 和变量名填入此处</p>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">模板 ID</label>
            <input
              type="text"
              value={cfg.templateId}
              onChange={e => setCfg(c => ({ ...c, templateId: e.target.value }))}
              placeholder="例：T1234567890abcdef"
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 font-mono"
            />
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700 space-y-1.5">
            <p className="font-semibold">模板变量说明</p>
            <p>系统使用固定的两个变量，请确保模板中包含以下字段：</p>
            <ul className="space-y-1 list-disc list-inside font-mono text-xs">
              <li><span className="bg-gray-100 px-1 rounded">{"{{thing19.DATA}}"}</span> — 姓名 · 事件类型（如「张伟 · 生日」「结婚纪念日 · 纪念日」）</li>
              <li><span className="bg-gray-100 px-1 rounded">{"{{time24.DATA}}"}</span> — 事件日期时间（如「2026-04-10 08:00」）</li>
            </ul>
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

      {/* ── 上次运行状态 & 手动触发 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">运行记录</h2>
          <p className="text-xs text-gray-400 mt-0.5">可立即触发一次发送以测试配置是否正确</p>
        </div>
        <div className="p-6 space-y-4">
          {cfg.lastRunAt ? (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm space-y-1.5">
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>上次运行：{new Date(cfg.lastRunAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              {cfg.lastRunResult && (
                <div className="flex gap-4 text-xs text-gray-500 pl-6">
                  <span className="text-green-600">✓ 发送 {cfg.lastRunResult.sent} 条</span>
                  <span>跳过 {cfg.lastRunResult.skipped} 条</span>
                  {cfg.lastRunResult.errors > 0 && <span className="text-red-500">✗ 失败 {cfg.lastRunResult.errors} 条</span>}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">暂无运行记录</p>
          )}

          {runMsg && (
            <div className={`text-sm px-3 py-2 rounded-lg ${runMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {runMsg.text}
            </div>
          )}

          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "执行中..." : "立即执行一次"}
          </button>
        </div>
      </div>

      {/* ── 说明 ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">配置说明</h2>
        </div>
        <div className="p-6 space-y-4 text-sm text-gray-600">
          {[
            "确保「微信配置」页面中已正确填写 AppID 和 AppSecret（公众号必须是服务号才支持模板消息）。",
            "在公众号后台进入「功能 → 模板消息 → 添加模板」，选择或自定义生日提醒模板，获取模板 ID。",
            "模板需包含两个固定变量：{{thing19.DATA}}（姓名·事件类型）和 {{time24.DATA}}（事件时间）。",
            "系统将在每天设定时间自动扫描数据库，向当天或指定天数内过生日的联系人所属用户发送通知。",
            "只有通过微信登录的用户才会收到通知，测试账号用户不会收到。",
          ].map((text, i) => (
            <div key={i} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── EmailConfigPanel ─────────────────────────────────────────────────────────
interface EmailConfig {
  enabled:       boolean;
  smtpHost:      string;
  smtpPort:      number;
  smtpSecure:    boolean;
  senderEmail:   string;
  authCodeSet:   boolean;
  daysBefore:    number[];
  sendHour:      number;
  lastRunAt:     string | null;
  lastRunResult: { sent: number; errors: number } | null;
}

function EmailConfigPanel({ adminKey }: { adminKey: string }) {
  const BASE = import.meta.env.BASE_URL;
  const headers = { "Content-Type": "application/json", "x-admin-key": adminKey };

  const [cfg, setCfg]         = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Edit state
  const [enabled,     setEnabled]     = useState(true);
  const [smtpHost,    setSmtpHost]    = useState("smtp.qq.com");
  const [smtpPort,    setSmtpPort]    = useState(465);
  const [smtpSecure,  setSmtpSecure]  = useState(true);
  const [senderEmail, setSenderEmail] = useState("");
  const [authCode,    setAuthCode]    = useState("");
  const [daysBefore,  setDaysBefore]  = useState<number[]>([0, 1]);
  const [sendHour,    setSendHour]    = useState(8);

  // Test email
  const [testEmail, setTestEmail]   = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testMsg, setTestMsg]       = useState<{ type: "ok" | "err"; text: string } | null>(null);

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

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const body: Record<string, unknown> = { enabled, smtpHost, smtpPort, smtpSecure, senderEmail, daysBefore, sendHour };
      if (authCode.trim()) body.authCode = authCode.trim();
      const r = await fetch(`${BASE}api/admin/email-config`, { method: "PUT", headers, body: JSON.stringify(body) });
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
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`${BASE}api/admin/email-verify`, { method: "POST", headers });
      const d = await r.json();
      setMsg({ type: d.ok ? "ok" : "err", text: d.message });
    } catch {
      setMsg({ type: "err", text: "验证请求失败" });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail.includes("@")) { setTestMsg({ type: "err", text: "请输入有效邮箱" }); return; }
    setTestLoading(true); setTestMsg(null);
    try {
      const r = await fetch(`${BASE}api/admin/email-test`, { method: "POST", headers, body: JSON.stringify({ toEmail: testEmail }) });
      const d = await r.json();
      setTestMsg({ type: d.ok ? "ok" : "err", text: d.message });
    } catch {
      setTestMsg({ type: "err", text: "请求失败" });
    } finally {
      setTestLoading(false);
    }
  };

  const runNow = async () => {
    setRunLoading(true); setMsg(null);
    try {
      const r = await fetch(`${BASE}api/admin/email-run`, { method: "POST", headers });
      const d = await r.json();
      setMsg({ type: "ok", text: `执行完成：发送 ${d.sent} 封，失败 ${d.errors} 封` });
      await load();
    } catch {
      setMsg({ type: "err", text: "执行失败" });
    } finally {
      setRunLoading(false);
    }
  };

  const toggleDay = (d: number) => {
    setDaysBefore(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b));
  };

  if (loading) return <div className="text-center py-20 text-gray-400">加载中…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 全局消息 */}
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
          msg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {msg.type === "ok" ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {msg.text}
        </div>
      )}

      {/* 开关 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled ? "bg-rose-500" : "bg-gray-200"}`}>
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">邮件生日提醒</p>
              <p className="text-sm text-gray-400">{enabled ? "已开启，按计划自动发送提醒邮件" : "已关闭，不会发送任何邮件"}</p>
            </div>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? "bg-rose-500" : "bg-gray-300"}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? "left-7" : "left-1"}`} />
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
              onChange={e => setSmtpHost(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
              placeholder="smtp.qq.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">端口</label>
            <input
              type="number"
              value={smtpPort}
              onChange={e => setSmtpPort(parseInt(e.target.value) || 465)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSmtpSecure(!smtpSecure)}
            className={`relative w-10 h-5 rounded-full transition-colors ${smtpSecure ? "bg-rose-500" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${smtpSecure ? "left-5" : "left-0.5"}`} />
          </button>
          <span className="text-sm text-gray-600">启用 SSL/TLS 加密（推荐 QQ 邮箱保持开启）</span>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500">发件邮箱地址</label>
          <input
            type="email"
            value={senderEmail}
            onChange={e => setSenderEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            placeholder="example@qq.com"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500">
            邮箱授权码
            {cfg?.authCodeSet && <span className="ml-2 text-green-600">（已设置，留空则保持不变）</span>}
          </label>
          <input
            type="password"
            value={authCode}
            onChange={e => setAuthCode(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            placeholder={cfg?.authCodeSet ? "••••••••••••••••" : "QQ 邮箱授权码（非登录密码）"}
          />
          <p className="text-xs text-gray-400">QQ 邮箱需在「设置 → 账户 → POP3/SMTP 服务」处生成授权码</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
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
          <label className="text-xs text-gray-500">提前提醒天数（可多选）</label>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 3, 7].map(d => (
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
              min={6} max={22}
              value={sendHour}
              onChange={e => setSendHour(parseInt(e.target.value))}
              className="flex-1 accent-rose-500"
            />
            <span className="text-sm font-semibold text-rose-600 w-14 text-right">{sendHour}:00</span>
          </div>
          <p className="text-xs text-gray-400">建议设置在早上 8 点，确保用户及时看到提醒</p>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          保存设置
        </button>
      </div>

      {/* 发送测试邮件 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Send className="w-4 h-4 text-rose-500" /> 发送测试邮件
        </h3>

        {testMsg && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            testMsg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}>
            {testMsg.type === "ok" ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {testMsg.text}
          </div>
        )}

        <div className="flex gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={e => setTestEmail(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            placeholder="收件邮箱地址"
          />
          <button
            onClick={sendTest}
            disabled={testLoading || !testEmail}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-medium hover:bg-rose-600 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {testLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            发送测试
          </button>
        </div>
        <p className="text-xs text-gray-400">发送前请先保存 SMTP 配置，测试邮件将立即送达，不受「发送时机」限制。</p>
      </div>

      {/* 手动触发 & 上次运行 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Play className="w-4 h-4 text-rose-500" /> 手动触发 & 运行记录
        </h3>

        {cfg?.lastRunAt && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm space-y-1">
            <p className="text-gray-500">上次运行：<span className="text-gray-800 font-medium">{formatDate(cfg.lastRunAt)}</span></p>
            {cfg.lastRunResult && (
              <p className="text-gray-500">
                结果：已发送 <span className="text-green-600 font-medium">{cfg.lastRunResult.sent}</span> 封，
                失败 <span className={cfg.lastRunResult.errors > 0 ? "text-red-600 font-medium" : "text-gray-400"}>{cfg.lastRunResult.errors}</span> 封
              </p>
            )}
          </div>
        )}

        <button
          onClick={runNow}
          disabled={runLoading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {runLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          立即执行一次邮件提醒检查
        </button>
        <p className="text-xs text-gray-400">只会向「提前天数」范围内过生日的联系人发送邮件，不会重复发送当天已发的内容。</p>
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
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ShareConfigPanel ─────────────────────────────────────────────────────────
interface ShareConfig {
  title:  string;
  desc:   string;
  imgUrl: string;
  link:   string;
}

function ShareConfigPanel({ adminKey }: { adminKey: string }) {
  const [cfg, setCfg]   = useState<ShareConfig>({ title: "", desc: "", imgUrl: "", link: "" });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/admin/share-config`, {
      headers: { "x-admin-key": adminKey },
    })
      .then(r => r.ok ? r.json() : null)
      .then((d: ShareConfig | null) => { if (d) setCfg(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [adminKey]);

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/share-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(cfg),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">加载中…</div>;

  const previewTitle  = cfg.title  || "生日通 - 不再错过重要生日";
  const previewDesc   = cfg.desc   || "智能生日提醒，农历公历都支持";
  const previewImgUrl = cfg.imgUrl || "";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 说明 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-700 leading-relaxed">
        <p className="font-semibold mb-1">微信分享配置</p>
        <p>在微信内打开页面时，点击右上角"分享给朋友"或"分享到朋友圈"，会按照下方配置展示分享卡片。需在微信公众号后台完成 JS-SDK 域名配置后生效。</p>
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
            <label className="block text-xs font-medium text-gray-600 mb-1.5">分享标题</label>
            <input
              type="text"
              value={cfg.title}
              onChange={e => setCfg(c => ({ ...c, title: e.target.value }))}
              placeholder="生日通 - 不再错过重要生日"
              maxLength={64}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400">留空则使用默认标题（最多 64 字）</p>
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">分享描述</label>
            <input
              type="text"
              value={cfg.desc}
              onChange={e => setCfg(c => ({ ...c, desc: e.target.value }))}
              placeholder="智能生日提醒，农历公历都支持"
              maxLength={128}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400">留空则使用默认描述（最多 128 字）</p>
          </div>

          {/* 图片 URL */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">分享缩略图 URL</label>
            <input
              type="url"
              value={cfg.imgUrl}
              onChange={e => setCfg(c => ({ ...c, imgUrl: e.target.value }))}
              placeholder="https://yourdomain.com/share-thumb.jpg"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400">建议 300×300 px 以上的正方形图片，须为可公开访问的 https 链接</p>
          </div>

          {/* 分享链接 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">分享链接（落地页）</label>
            <input
              type="url"
              value={cfg.link}
              onChange={e => setCfg(c => ({ ...c, link: e.target.value }))}
              placeholder="https://yourdomain.com/birthday-app/"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400">留空则默认分享当前页面 URL</p>
          </div>
        </div>
      </div>

      {/* 预览 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">分享卡片预览</h3>
          <p className="text-xs text-gray-400 mt-0.5">模拟微信「发送给朋友」卡片样式</p>
        </div>
        <div className="p-6">
          <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-3 max-w-xs bg-gray-50">
            {previewImgUrl ? (
              <img src={previewImgUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-200" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-rose-100 flex-shrink-0 flex items-center justify-center text-rose-400 text-xl">🎂</div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{previewTitle}</p>
              <p className="text-xs text-gray-400 mt-1 line-clamp-1">{previewDesc}</p>
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
          <li>登录微信公众平台 → <strong>设置与开发 → 公众号设置 → 功能设置</strong></li>
          <li>找到 <strong>「JS接口安全域名」</strong>，添加你的域名（不含 https://，不含路径）</li>
          <li>分享功能仅在微信内置浏览器（公众号 H5）中生效，普通浏览器无效</li>
        </ol>
      </div>
    </div>
  );
}

type Tab = "users" | "wechat" | "ai" | "notify" | "email" | "content" | "share";

function Dashboard({ adminKey, onLogout }: { adminKey: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("users");

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "users",   label: "用户管理", icon: <Users      className="w-4 h-4" /> },
    { id: "wechat",  label: "微信配置", icon: <Settings   className="w-4 h-4" /> },
    { id: "ai",      label: "AI 模型",  icon: <Sparkles   className="w-4 h-4" /> },
    { id: "notify",  label: "消息通知", icon: <Bell       className="w-4 h-4" /> },
    { id: "email",   label: "邮件配置", icon: <Mail       className="w-4 h-4" /> },
    { id: "content", label: "内容配置", icon: <FileText   className="w-4 h-4" /> },
    { id: "share",   label: "分享配置", icon: <Share2     className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen w-full flex bg-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
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
          {navItems.map(item => (
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
            {navItems.find(n => n.id === tab)?.label}
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
          {tab === "users"   && <UsersPanel         adminKey={adminKey} />}
          {tab === "wechat"  && <WechatConfigPanel  adminKey={adminKey} />}
          {tab === "ai"      && <AiConfigPanel      adminKey={adminKey} />}
          {tab === "notify"  && <NotifyConfigPanel  adminKey={adminKey} />}
          {tab === "email"   && <EmailConfigPanel   adminKey={adminKey} />}
          {tab === "content" && <ContentConfigPanel adminKey={adminKey} />}
          {tab === "share"   && <ShareConfigPanel   adminKey={adminKey} />}
        </div>
      </main>
    </div>
  );
}

const ADMIN_SESSION_KEY = "birthday_admin_session";

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Admin() {
  const [adminKey, setAdminKey] = useState<string | null>(
    () => sessionStorage.getItem(ADMIN_SESSION_KEY)
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
