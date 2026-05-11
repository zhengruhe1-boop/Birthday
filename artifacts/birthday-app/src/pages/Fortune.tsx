import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Sparkles,
  Heart,
  Briefcase,
  Coins,
  Activity,
  Shirt,
  Lightbulb,
  RefreshCw,
} from "lucide-react";
import { getAuthHeaders } from "@/hooks/use-auth";
import { ZODIAC_SYMBOLS } from "@/lib/zodiac";

const SIGNS = [
  "白羊座","金牛座","双子座","巨蟹座","狮子座","处女座",
  "天秤座","天蝎座","射手座","摩羯座","水瓶座","双鱼座",
];

interface FortuneResult {
  summary: string;
  love: { score: number; desc: string };
  career: { score: number; desc: string };
  wealth: { score: number; desc: string };
  health: { score: number; desc: string };
  outfit: string;
  tip: string;
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-rose-400" : score >= 60 ? "bg-amber-400" : "bg-slate-300";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-500 w-6 text-right">{score}</span>
    </div>
  );
}

const DIM_META = [
  { key: "love",   label: "爱情", Icon: Heart,     color: "text-rose-400" },
  { key: "career", label: "事业", Icon: Briefcase,  color: "text-blue-400" },
  { key: "wealth", label: "财运", Icon: Coins,      color: "text-amber-400" },
  { key: "health", label: "健康", Icon: Activity,   color: "text-green-400" },
] as const;

export default function Fortune() {
  const [, setLocation] = useLocation();
  const [selectedSign, setSelectedSign] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FortuneResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const generate = async (sign: string) => {
    setSelectedSign(sign);
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const authHeaders = getAuthHeaders();
      const r = await fetch(`${import.meta.env.BASE_URL}api/fortune`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ sign, date: today }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "生成失败，请稍后重试");
      } else {
        setResult(data.fortune as FortuneResult);
      }
    } catch {
      setError("网络错误，请检查连接后重试");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSelectedSign(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="app-container flex flex-col bg-gradient-to-b from-violet-50/60 to-white">
      {/* Header */}
      <header
        className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-border/50 px-4 py-4 flex items-center gap-3"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => setLocation("/tools")}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold tracking-tight">今日运势</h1>
          <p className="text-xs text-muted-foreground">{today.replace(/-/g, ".")}</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5 pb-28">

        {/* 星座选择 */}
        {!result && !loading && (
          <>
            <p className="text-sm text-gray-500 mb-4 text-center">
              {selectedSign ? `已选：${selectedSign}` : "选择你的星座，查看今日运势"}
            </p>
            <div className="grid grid-cols-4 gap-2.5">
              {SIGNS.map((sign) => {
                const symbol = ZODIAC_SYMBOLS[sign] ?? "✦";
                const active = selectedSign === sign;
                return (
                  <button
                    key={sign}
                    onClick={() => generate(sign)}
                    className={`flex flex-col items-center gap-1 rounded-2xl py-3 px-1 border-2 transition-all ${
                      active
                        ? "border-violet-400 bg-violet-50 shadow-md"
                        : "border-gray-100 bg-white hover:border-violet-200 hover:bg-violet-50/50"
                    }`}
                  >
                    <span className="text-2xl">{symbol}</span>
                    <span className="text-[11px] text-gray-600 font-medium leading-tight">{sign.replace("座", "")}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* 加载中 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-violet-400 animate-pulse" />
            </div>
            <p className="text-sm text-gray-400">正在为 {selectedSign} 解读今日运势…</p>
          </div>
        )}

        {/* 错误 */}
        {error && !loading && (
          <div className="mt-4 bg-red-50 border border-red-100 rounded-2xl p-5 text-center space-y-3">
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={reset}
              className="text-xs text-gray-400 underline underline-offset-2"
            >
              重新选择星座
            </button>
          </div>
        )}

        {/* 结果 */}
        {result && !loading && (
          <div className="space-y-4">
            {/* 标题 */}
            <div className="text-center py-4">
              <div className="text-4xl mb-1">{ZODIAC_SYMBOLS[selectedSign!] ?? "✦"}</div>
              <h2 className="text-lg font-bold text-gray-800">{selectedSign}</h2>
              <p className="text-xs text-gray-400 mt-0.5">今日运势</p>
            </div>

            {/* 总运概述 */}
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Sparkles className="w-4 h-4 opacity-80" />
                <span className="text-xs font-semibold opacity-80 uppercase tracking-wider">总运概述</span>
              </div>
              <p className="text-sm leading-relaxed">{result.summary}</p>
            </div>

            {/* 四维指数 */}
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">运势指数</h3>
              {DIM_META.map(({ key, label, Icon, color }) => {
                const dim = result[key];
                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <span className="text-xs font-semibold text-gray-600">{label}</span>
                    </div>
                    <ScoreBar score={dim.score} />
                    <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{dim.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* 穿搭推荐 */}
            <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <Shirt className="w-4 h-4 text-pink-400" />
                <h3 className="text-sm font-semibold text-gray-700">今日穿搭</h3>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{result.outfit}</p>
            </div>

            {/* 今日小贴士 */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-amber-700">今日小贴士</h3>
              </div>
              <p className="text-sm text-amber-600 leading-relaxed">{result.tip}</p>
            </div>

            {/* 换一个星座 */}
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              换一个星座
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
