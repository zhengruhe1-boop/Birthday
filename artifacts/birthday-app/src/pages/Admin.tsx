import { useState, useEffect } from "react";
import { Users, CalendarDays, ChevronDown, ChevronRight, RefreshCw, LogOut, Settings, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

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
  const [config, setConfig] = useState<WechatConfig>({ appId: "", appSecret: "", appSecretSet: false, domain: "" });
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
          appId: config.appId,
          appSecret: config.appSecret,
          domain: config.domain,
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

  const isConfigured = !!(config.appId && config.appSecretSet && config.domain);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Status badge */}
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${
        isConfigured ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"
      }`}>
        {isConfigured
          ? <><CheckCircle className="w-4 h-4" /> 微信 OAuth 已配置，前端将使用真实微信登录</>
          : <><AlertCircle className="w-4 h-4" /> 尚未完整配置，前端仍使用测试模式登录</>}
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">微信公众号配置</h2>
          <p className="text-xs text-gray-400 mt-0.5">需要微信服务号，在公众号后台 → 开发 → 基本配置中获取</p>
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

// ─── Dashboard ────────────────────────────────────────────────────────────────
type Tab = "users" | "wechat";

function Dashboard({ adminKey, onLogout }: { adminKey: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("users");

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "users",  label: "用户管理", icon: <Users className="w-4 h-4" /> },
    { id: "wechat", label: "微信配置", icon: <Settings className="w-4 h-4" /> },
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
          {tab === "users"  && <UsersPanel  adminKey={adminKey} />}
          {tab === "wechat" && <WechatConfigPanel adminKey={adminKey} />}
        </div>
      </main>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Admin() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  if (!adminKey) return <LoginPage onLogin={setAdminKey} />;
  return <Dashboard adminKey={adminKey} onLogout={() => setAdminKey(null)} />;
}
