import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, User, X, Globe, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { detectPlatform, PLATFORM_LABEL, PLATFORM_ICON, PLATFORM_COLOR } from "@/lib/platform";

// ── Legal Content Modal ────────────────────────────────────────────────────────
interface LegalContent { termsOfService: string; privacyPolicy: string; }

function LegalModal({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]"
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {content.trim() ? (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{content}</p>
            ) : (
              <p className="text-sm text-gray-400 text-center py-12">暂无内容，管理员尚未配置。</p>
            )}
          </div>
          <div className="h-safe-area-inset-bottom pb-6 pt-3 px-6">
            <button onClick={onClose} className="w-full py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors">
              我已知晓
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const DEVICE_ID_KEY = "birthday_app_device_id";
const TOKEN_KEY = "birthday_app_token";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) { id = generateUUID(); localStorage.setItem(DEVICE_ID_KEY, id); }
  return id;
}

interface WechatPublicConfig {
  configured: boolean;
  appId: string | null;
  loginMode: "wechat" | "mock";
}

// Platform tab icons as inline SVG components
function IconH5() {
  return <Globe className="w-4 h-4" />;
}
function IconMP() {
  return <MessageCircle className="w-4 h-4" />;
}
function IconMini() {
  return <Smartphone className="w-4 h-4" />;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { mockLogin, isAuthenticated } = useAuth();
  const [nickname, setNickname] = useState("");
  const [wechatConfig, setWechatConfig] = useState<WechatPublicConfig | null>(null);
  const [wechatError, setWechatError] = useState<string | null>(null);
  const [legalContent, setLegalContent] = useState<LegalContent>({ termsOfService: "", privacyPolicy: "" });
  const [legalModal, setLegalModal] = useState<"terms" | "privacy" | null>(null);

  // Detected platform (auto)
  const platform = detectPlatform();
  const loginMode = wechatConfig?.loginMode ?? "mock";

  // ── On mount: handle OAuth callback / mini-program token in URL ───────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token   = params.get("wechat_token") || params.get("mp_token");
    const err     = params.get("wechat_error");

    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      window.history.replaceState({}, "", window.location.pathname);
      setLocation("/");
      return;
    }
    if (err) {
      const messages: Record<string, string> = {
        no_code: "微信授权未完成，请重试",
        not_configured: "微信登录尚未配置",
        token_failed: "微信授权码无效，请重试",
        userinfo_failed: "获取微信用户信息失败，请重试",
        server_error: "服务器错误，请稍后重试",
      };
      setWechatError(messages[err] ?? "微信登录失败，请重试");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [setLocation]);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    fetch(`${base}api/auth/wechat/public-config`)
      .then(r => r.json())
      .then((data: WechatPublicConfig) => setWechatConfig(data))
      .catch(() => setWechatConfig({ configured: false, appId: null, loginMode: "mock" }));
    fetch(`${base}api/auth/legal`)
      .then(r => r.json())
      .then((data: LegalContent) => setLegalContent(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isAuthenticated) setLocation("/");
  }, [isAuthenticated, setLocation]);

  const handleWechatLogin = () => {
    if (!wechatConfig?.configured || !wechatConfig.appId) {
      setWechatError("微信登录尚未配置，请联系管理员");
      return;
    }
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const callbackUrl = encodeURIComponent(`${window.location.origin}${base}/api/auth/wechat/oauth/callback`);
    const oauthUrl =
      `https://open.weixin.qq.com/connect/oauth2/authorize` +
      `?appid=${wechatConfig.appId}` +
      `&redirect_uri=${callbackUrl}` +
      `&response_type=code&scope=snsapi_userinfo&state=login#wechat_redirect`;
    window.location.href = oauthUrl;
  };

  const handleMockLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const name = nickname.trim() || "测试用户";
    const deviceId = getOrCreateDeviceId();
    mockLogin.mutate({ data: { nickname: name, deviceId } } as Parameters<typeof mockLogin.mutate>[0]);
  };

  const handleQuickLogin = () => {
    const deviceId = getOrCreateDeviceId();
    mockLogin.mutate({ data: { nickname: "测试用户", deviceId } } as Parameters<typeof mockLogin.mutate>[0]);
  };

  return (
    <div className="app-container flex flex-col relative overflow-hidden bg-white">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src={`${import.meta.env.BASE_URL}images/hero-bg.png`} alt="background"
          className="w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/60 to-white" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col pt-10 px-6 pb-8">

        {/* ── Logo & title ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center mb-8"
        >
          <div className="w-20 h-20 rounded-3xl bg-white shadow-xl shadow-primary/20 flex items-center justify-center p-2 mb-5 transform -rotate-3">
            <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="生日通 Logo"
              className="w-full h-full object-contain rounded-2xl transform rotate-3" />
          </div>
          <h1 className="text-4xl font-display font-bold text-foreground mb-2 tracking-tight">生日通</h1>
          <p className="text-muted-foreground text-base">记住每一个重要的日子</p>
        </motion.div>

        {/* ── Login area ── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="w-full max-w-sm mx-auto space-y-4"
        >
          {wechatError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3 text-center">
              {wechatError}
            </div>
          )}

          {/* ── H5 / 小程序 访客登录 ── */}
          {(platform === "h5" || platform === "miniprogram") && loginMode === "mock" && (
            <div className="bg-white/85 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-border/50 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                {platform === "miniprogram" ? <IconMini /> : <IconH5 />}
                <h3 className="text-base font-bold">
                  {platform === "miniprogram" ? "小程序访客登录" : "H5 访客登录"}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                同一昵称始终对应同一账号，换设备或清除缓存数据不丢失
              </p>

              <Button className="w-full" onClick={handleQuickLogin} disabled={mockLogin.isPending}>
                {mockLogin.isPending ? "登录中..." : "快速进入（本机账号）"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs text-muted-foreground">
                  <span className="bg-white px-2">或输入昵称切换账号</span>
                </div>
              </div>

              <form onSubmit={handleMockLogin} className="space-y-3">
                <Input
                  placeholder="输入昵称（选填）"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  icon={<User className="w-5 h-5" />}
                />
                <Button type="submit" variant="outline" className="w-full" disabled={mockLogin.isPending}>
                  {mockLogin.isPending ? "登录中..." : "用此昵称登录"}
                </Button>
              </form>
            </div>
          )}

          {/* ── 微信公众号 OAuth 登录 ── */}
          {(platform === "wechat_mp" || loginMode === "wechat") && (
            <div className="bg-white/85 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-border/50 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <IconMP />
                <h3 className="text-base font-bold">微信公众号登录</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                使用微信账号授权登录，无需手动输入任何信息
              </p>
              <Button
                size="lg"
                className="w-full bg-[#07C160] hover:bg-[#06ad56] text-white border-none shadow-lg shadow-[#07C160]/20 flex items-center gap-2"
                onClick={handleWechatLogin}
                disabled={wechatConfig === null}
              >
                <MessageCircle className="w-5 h-5" />
                {wechatConfig === null ? "加载中..." : "微信一键登录"}
              </Button>

              {/* Fallback to mock login in wechat_mp if server is mock mode */}
              {loginMode === "mock" && platform === "wechat_mp" && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-xs text-muted-foreground">
                      <span className="bg-white px-2">或以访客身份进入</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={handleQuickLogin} disabled={mockLogin.isPending}>
                    {mockLogin.isPending ? "登录中..." : "访客模式进入"}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* ── 小程序 in wechat mode: show wechat login card ── */}
          {platform === "miniprogram" && loginMode === "wechat" && (
            <div className="bg-white/85 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-border/50 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <IconMini />
                <h3 className="text-base font-bold">小程序授权登录</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                小程序 WebView 内，通过微信授权登录以使用完整功能
              </p>
              <Button
                size="lg"
                className="w-full bg-[#07C160] hover:bg-[#06ad56] text-white border-none shadow-lg shadow-[#07C160]/20 flex items-center gap-2"
                onClick={handleWechatLogin}
                disabled={wechatConfig === null}
              >
                <MessageCircle className="w-5 h-5" />
                {wechatConfig === null ? "加载中..." : "微信一键登录"}
              </Button>
            </div>
          )}

        </motion.div>

        <div className="mt-5 text-center text-xs text-muted-foreground">
          登录即代表同意{" "}
          <button type="button" onClick={() => setLegalModal("terms")} className="text-primary hover:underline">用户协议</button>
          {" "}和{" "}
          <button type="button" onClick={() => setLegalModal("privacy")} className="text-primary hover:underline">隐私政策</button>
        </div>
      </div>

      {legalModal === "terms" && <LegalModal title="用户协议" content={legalContent.termsOfService} onClose={() => setLegalModal(null)} />}
      {legalModal === "privacy" && <LegalModal title="隐私政策" content={legalContent.privacyPolicy} onClose={() => setLegalModal(null)} />}
    </div>
  );
}
