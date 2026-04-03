import { useState } from "react";
import { Users, CalendarDays, ChevronDown, ChevronRight, Shield } from "lucide-react";

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
  const cal = c.birthdayLunar ? "农历" : "";
  const year = c.birthYear ? `${c.birthYear}年` : "";
  return `${cal}${year}${c.birthdayMonth}月${c.birthdayDay}日`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const handleLogin = async () => {
    if (password !== ADMIN_KEY) {
      setAuthError("密码错误");
      return;
    }
    setLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/admin/stats`, {
        headers: { "x-admin-key": password },
      });
      if (!res.ok) {
        setAuthError("验证失败，请检查密码");
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
      setAuthed(true);
    } catch {
      setAuthError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!authed) {
    return (
      <div className="app-container flex flex-col items-center justify-center bg-slate-50/30 min-h-screen">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-border/50 w-full max-w-sm mx-4">
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold">管理后台</h1>
            <p className="text-sm text-muted-foreground text-center">生日通 · 数据管理</p>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="请输入管理密码"
              className="w-full px-4 py-3 rounded-xl border border-border bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            {authError && <p className="text-xs text-destructive">{authError}</p>}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-60"
            >
              {loading ? "验证中..." : "进入后台"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container flex flex-col bg-slate-50/30 min-h-screen">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-border/50 px-5 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <h1 className="text-lg font-bold">管理后台</h1>
        </div>
      </header>

      <div className="flex-1 p-4 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-border/50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{data!.totalUsers}</p>
              <p className="text-xs text-muted-foreground">注册用户</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-border/50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{data!.totalContacts}</p>
              <p className="text-xs text-muted-foreground">生日记录</p>
            </div>
          </div>
        </div>

        {/* Users list */}
        <div className="bg-white rounded-3xl shadow-sm border border-border/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">用户列表</h2>
          </div>
          <div className="divide-y divide-border/40">
            {data!.users.map(user => (
              <div key={user.id}>
                <button
                  onClick={() => toggleUser(user.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50/60 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {user.nickname.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-tight">{user.nickname}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {user.openId?.startsWith("mock:") ? "测试账号" : (user.openId || "未知")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-medium text-primary bg-primary/8 px-2 py-0.5 rounded-full">
                      {user.contactCount} 条
                    </span>
                    {expanded.has(user.id)
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {expanded.has(user.id) && (
                  <div className="bg-slate-50/60 px-5 pb-4">
                    <p className="text-[11px] text-muted-foreground mb-3 pt-1">
                      注册时间：{formatDate(user.createdAt)}
                    </p>
                    {user.contacts.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">暂无生日记录</p>
                    ) : (
                      <div className="space-y-2">
                        {user.contacts.map(c => (
                          <div key={c.id} className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm border border-border/40">
                            <div className="w-7 h-7 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 text-xs font-bold flex-shrink-0">
                              {c.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground leading-tight">{c.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatBirthday(c)}
                                {c.relation && ` · ${c.relation}`}
                              </p>
                            </div>
                            <p className="text-[10px] text-muted-foreground flex-shrink-0">
                              {formatDate(c.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
