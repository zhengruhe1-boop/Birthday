import { useLocation } from "wouter";
import {
  ChevronRight,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  MessageCircle,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { detectPlatform, PLATFORM_LABEL, PLATFORM_ICON, PLATFORM_COLOR } from "@/lib/platform";

const menuItems = [
  {
    section: "消息与通知",
    items: [
      { icon: <Bell className="w-[18px] h-[18px] text-rose-500" />, bg: "bg-rose-50", label: "提醒设置", path: null },
      { icon: <MessageCircle className="w-[18px] h-[18px] text-green-600" />, bg: "bg-green-50", label: "公众号绑定", path: null },
    ],
  },
  {
    section: "其他",
    items: [
      { icon: <Shield className="w-[18px] h-[18px] text-blue-500" />, bg: "bg-blue-50", label: "隐私政策", path: null },
      { icon: <HelpCircle className="w-[18px] h-[18px] text-violet-500" />, bg: "bg-violet-50", label: "帮助与反馈", path: null },
    ],
  },
];

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoading } = useAuth();

  if (isLoading || !user) {
    return (
      <div className="app-container flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const avatarText = user.nickname ? user.nickname[0].toUpperCase() : "U";
  const platform = detectPlatform();

  return (
    <div className="app-container flex flex-col bg-slate-50/50">
      <header
        className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-border/50 px-4 py-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <h1 className="text-xl font-bold tracking-tight">我的</h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-28">
        {/* 用户信息卡片 */}
        <div className="mx-4 mt-5 mb-4 bg-white rounded-2xl border border-border/50 shadow-sm px-5 py-5 flex items-center gap-4">
          {user.avatarUrl ? (
            <img
              src={
                user.avatarUrl.startsWith("http")
                  ? user.avatarUrl
                  : `${import.meta.env.BASE_URL}${user.avatarUrl.replace(/^\//, "")}`
              }
              alt={user.nickname}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/20 flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {avatarText}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base leading-tight truncate">
              {user.nickname || "用户"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user.openId && !String(user.openId).startsWith("mock:")
                ? "微信用户"
                : "访客账号"}
            </p>
            <span
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium mt-1.5 ${PLATFORM_COLOR[platform]}`}
            >
              {PLATFORM_ICON[platform]} {PLATFORM_LABEL[platform]}
            </span>
          </div>
          <UserIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </div>

        {/* 菜单组 */}
        {menuItems.map((group) => (
          <div key={group.section} className="mx-4 mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {group.section}
            </p>
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden divide-y divide-gray-100">
              {group.items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => item.path && setLocation(item.path)}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                >
                  <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
                    {item.icon}
                  </div>
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* 退出登录 */}
        <div className="mx-4 mb-4">
          <button
            onClick={() => { logout(); setLocation("/login"); }}
            className="w-full flex items-center justify-between px-4 py-4 bg-white rounded-2xl border border-border/50 shadow-sm text-sm font-medium text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <LogOut className="w-[18px] h-[18px] text-red-500" />
              </div>
              退出登录
            </div>
            <ChevronRight className="w-4 h-4 text-red-400" />
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">生日通 · 记住每一个重要的日子</p>
      </main>
    </div>
  );
}
