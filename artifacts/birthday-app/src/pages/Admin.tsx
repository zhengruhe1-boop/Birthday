import { useState } from "react";
import { Users, CalendarDays, Shield, ChevronDown, ChevronRight, RefreshCw, LogOut } from "lucide-react";

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
  contactCount: number;
  contacts: ContactRecord[];
}

interface StatsData {
  totalUsers: number;
  totalContacts: number;
  users: UserRecord[];
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

// ─── Login page ──────────────────────────────────────────────────────────────
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
          <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center">
            <Shield className="w-7 h-7 text-rose-500" />
          </div>
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

// ─── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ adminKey, onLogout }: { adminKey: string; onLogout: () => void }) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [activeUser, setActiveUser] = useState<UserRecord | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/stats`, {
        headers: { "x-admin-key": adminKey },
      });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on mount
  useState(() => { load(); });

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-6 py-6 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
              <Shield className="w-4 h-4 text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">生日通</p>
              <p className="text-[10px] text-gray-400">管理后台</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-rose-50 text-rose-600">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">用户管理</span>
          </div>
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">退出登录</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">用户管理</h1>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            刷新数据
          </button>
        </header>

        <div className="flex-1 p-8 space-y-6 overflow-auto">
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
              <h2 className="text-sm font-semibold text-gray-700">用户列表</h2>
              {data && <span className="text-xs text-gray-400">共 {data.totalUsers} 名用户</span>}
            </div>

            {!data ? (
              <div className="flex items-center justify-center py-20 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">加载中...</span>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">用户</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">账号类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Open ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">生日条数</th>
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
                          onClick={() => { toggleExpand(user.id); setActiveUser(user); }}
                        >
                          <td className="px-6 py-4 text-gray-400">
                            {isExpanded
                              ? <ChevronDown className="w-4 h-4" />
                              : <ChevronRight className="w-4 h-4" />}
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
                          <td className="px-4 py-4 text-gray-400 font-mono text-xs max-w-48 truncate">
                            {user.openId || "—"}
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-1.5 text-gray-700 font-medium">
                              <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                              {user.contactCount} 条
                            </span>
                          </td>
                          <td className="px-4 py-4 text-gray-400 text-xs">{formatDate(user.createdAt)}</td>
                        </tr>

                        {isExpanded && (
                          <tr key={`${user.id}-detail`} className="bg-slate-50">
                            <td colSpan={6} className="px-12 py-4">
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
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Admin() {
  const [adminKey, setAdminKey] = useState<string | null>(null);

  if (!adminKey) {
    return <LoginPage onLogin={setAdminKey} />;
  }
  return <Dashboard adminKey={adminKey} onLogout={() => setAdminKey(null)} />;
}
