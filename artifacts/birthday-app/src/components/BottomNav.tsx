import { useLocation } from "wouter";
import { Home, Wrench, User } from "lucide-react";

const tabs = [
  { path: "/",        label: "首页",  Icon: Home   },
  { path: "/tools",   label: "小工具", Icon: Wrench  },
  { path: "/profile", label: "我的",  Icon: User   },
];

export default function BottomNav() {
  const [location, setLocation] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-white border-t border-gray-200 flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map(({ path, label, Icon }) => {
        const active = path === "/" ? location === "/" : location.startsWith(path);
        return (
          <button
            key={path}
            onClick={() => setLocation(path)}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors"
          >
            <Icon
              className={`w-6 h-6 transition-colors ${active ? "text-rose-500" : "text-gray-400"}`}
              strokeWidth={active ? 2.5 : 1.8}
            />
            <span
              className={`text-[11px] font-medium transition-colors ${active ? "text-rose-500" : "text-gray-400"}`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
