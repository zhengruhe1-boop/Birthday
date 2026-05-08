import { useLocation } from "wouter";
import {
  CalendarDays,
  Heart,
  Timer,
  Sparkles,
  Calculator,
  Star,
  ChevronRight,
} from "lucide-react";

const tools = [
  {
    id: "birthday",
    icon: <CalendarDays className="w-6 h-6" />,
    bg: "bg-rose-50",
    color: "text-rose-500",
    title: "添加生日",
    desc: "记录亲友生日，到期提醒",
    path: "/contact/new",
  },
  {
    id: "anniversary",
    icon: <Heart className="w-6 h-6" />,
    bg: "bg-pink-50",
    color: "text-pink-500",
    title: "添加纪念日",
    desc: "结婚纪念日、恋爱周年等",
    path: "/event/new/anniversary",
  },
  {
    id: "countdown",
    icon: <Timer className="w-6 h-6" />,
    bg: "bg-orange-50",
    color: "text-orange-500",
    title: "添加倒数日",
    desc: "考试、旅行、大事件倒计时",
    path: "/event/new/countdown",
  },
  {
    id: "other",
    icon: <Sparkles className="w-6 h-6" />,
    bg: "bg-violet-50",
    color: "text-violet-500",
    title: "其它提醒",
    desc: "自定义提醒事项",
    path: "/event/new/other",
  },
  {
    id: "age",
    icon: <Calculator className="w-6 h-6" />,
    bg: "bg-blue-50",
    color: "text-blue-500",
    title: "年龄计算器",
    desc: "根据生日计算精确年龄",
    path: null,
    comingSoon: true,
  },
  {
    id: "zodiac",
    icon: <Star className="w-6 h-6" />,
    bg: "bg-amber-50",
    color: "text-amber-500",
    title: "星座查询",
    desc: "输入生日查看星座运势",
    path: null,
    comingSoon: true,
  },
];

export default function Tools() {
  const [, setLocation] = useLocation();

  return (
    <div className="app-container flex flex-col bg-slate-50/50">
      <header
        className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-border/50 px-4 py-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <h1 className="text-xl font-bold tracking-tight">小工具</h1>
        <p className="text-xs text-muted-foreground mt-0.5">记录每一个重要的日子</p>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 pb-28 space-y-3">
        {tools.map((tool) => (
          <button
            key={tool.id}
            disabled={!!tool.comingSoon}
            onClick={() => tool.path && setLocation(tool.path)}
            className={`w-full text-left bg-white rounded-2xl border border-border/50 px-4 py-4 flex items-center gap-4 shadow-sm transition-all
              ${tool.comingSoon
                ? "opacity-50 cursor-default"
                : "hover:shadow-md active:scale-[0.98]"
              }`}
          >
            <div className={`w-12 h-12 rounded-xl ${tool.bg} flex items-center justify-center ${tool.color} flex-shrink-0`}>
              {tool.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{tool.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tool.desc}</p>
            </div>
            <div className="flex-shrink-0 flex items-center gap-1">
              {tool.comingSoon && (
                <span className="text-[10px] bg-gray-100 text-gray-400 rounded-full px-2 py-0.5">
                  即将上线
                </span>
              )}
              {!tool.comingSoon && (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </button>
        ))}
      </main>
    </div>
  );
}
