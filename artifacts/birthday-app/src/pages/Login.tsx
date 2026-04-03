import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

// ── Legal Content Modal ───────────────────────────────────────────────────────
interface LegalContent { termsOfService: string; privacyPolicy: string; }

function LegalModal({
  title,
  content,
  onClose,
}: { title: string; content: string; onClose: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

        {/* Sheet */}
        <motion.div
          className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {content.trim() ? (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{content}</p>
            ) : (
              <p className="text-sm text-gray-400 text-center py-12">暂无内容，管理员尚未配置。</p>
            )}
          </div>

          {/* Bottom safe area */}
          <div className="h-safe-area-inset-bottom pb-6 pt-3 px-6">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-colors"
            >
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
  if (!id) {
    id = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

interface WechatPublicConfig {
  configured: boolean;
  appId: string | null;
  loginMode: "wechat" | "mock";
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { mockLogin, isAuthenticated } = useAuth();
  const [nickname, setNickname] = useState("");
  const [wechatConfig, setWechatConfig] = useState<WechatPublicConfig | null>(null);
  const [wechatError, setWechatError] = useState<string | null>(null);

  // Derive whether we're in mock-first mode from the server config
  const loginMode = wechatConfig?.loginMode ?? "mock";
  const [showMockPanel, setShowMockPanel] = useState(false);

  // ── Legal content ────────────────────────────────────────────────────────────
  const [legalContent, setLegalContent] = useState<LegalContent>({ termsOfService: "", privacyPolicy: "" });
  const [legalModal, setLegalModal] = useState<"terms" | "privacy" | null>(null);

  // ── On mount: handle WeChat OAuth callback token in URL params ───────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("wechat_token");
    const err   = params.get("wechat_error");

    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      // Clean URL and navigate home
      window.history.replaceState({}, "", window.location.pathname);
      setLocation("/");
      return;
    }

    if (err) {
      const messages: Record<string, string> = {
        no_code:          "微信授权未完成，请重试",
        not_configured:   "微信登录尚未配置",
        token_failed:     "微信授权码无效，请重试",
        userinfo_failed:  "获取微信用户信息失败，请重试",
        server_error:     "服务器错误，请稍后重试",
      };
      setWechatError(messages[err] ?? "微信登录失败，请重试");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [setLocation]);

  // ── Fetch public config and legal content ────────────────────────────────────
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

  // ── WeChat OAuth redirect ─────────────────────────────────────────────────────
  const handleWechatLogin = () => {
    if (!wechatConfig?.configured || !wechatConfig.appId) {
      // Fall through to dev mode if not configured
      setShowMockPanel(true);
      return;
    }

    // Build callback URL: the domain stored in settings + /api/auth/wechat/oauth/callback
    // We redirect to WeChat's authorize page; WeChat will call our backend callback
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const callbackUrl = encodeURIComponent(
      `${window.location.origin}${base}/api/auth/wechat/oauth/callback`
    );
    const oauthUrl =
      `https://open.weixin.qq.com/connect/oauth2/authorize` +
      `?appid=${wechatConfig.appId}` +
      `&redirect_uri=${callbackUrl}` +
      `&response_type=code` +
      `&scope=snsapi_userinfo` +
      `&state=login` +
      `#wechat_redirect`;

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
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
          alt="background"
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/60 to-white"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col pt-14 px-6 pb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center mt-4 mb-10"
        >
          <div className="w-20 h-20 rounded-3xl bg-white shadow-xl shadow-primary/20 flex items-center justify-center p-2 mb-5 transform -rotate-3">
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="生日通 Logo"
              className="w-full h-full object-contain rounded-2xl transform rotate-3"
            />
          </div>
          <h1 className="text-4xl font-display font-bold text-foreground mb-2 tracking-tight">生日通</h1>
          <p className="text-muted-foreground text-base">记住每一个重要的日子</p>
        </motion.div>

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

          {/* ── 测试登录面板（loginMode=mock 或用户手动切换时显示）── */}
          {(loginMode === "mock" || showMockPanel) ? (
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm border border-border/50 space-y-4">
              <h3 className="text-lg font-bold text-center mb-1">测试登录</h3>
              <p className="text-xs text-center text-muted-foreground mb-4">
                用昵称登录：同一昵称始终对应同一账号，换设备或清除缓存数据不丢失
              </p>

              <Button
                className="w-full"
                onClick={handleQuickLogin}
                disabled={mockLogin.isPending}
              >
                {mockLogin.isPending ? "登录中..." : "快速进入（本机账号）"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50"></div>
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
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  disabled={mockLogin.isPending}
                >
                  {mockLogin.isPending ? "登录中..." : "用此昵称登录"}
                </Button>
              </form>

              {/* 如果是微信模式手动进入测试面板，提供返回入口 */}
              {loginMode === "wechat" && showMockPanel && (
                <div className="text-center mt-2">
                  <button
                    type="button"
                    onClick={() => setShowMockPanel(false)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    返回微信登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── 微信登录按钮（loginMode=wechat 且未手动切换）── */
            <>
              <Button
                size="lg"
                className="w-full bg-[#07C160] hover:bg-[#06ad56] text-white border-none shadow-lg shadow-[#07C160]/20 flex items-center gap-2"
                onClick={handleWechatLogin}
                disabled={wechatConfig === null}
              >
                <MessageCircle className="w-5 h-5" />
                {wechatConfig === null ? "加载中..." : "微信一键登录"}
              </Button>

              <div className="text-center mt-6">
                <button
                  onClick={() => setShowMockPanel(true)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
                >
                  使用测试账号登录 (Dev Mode)
                </button>
              </div>
            </>
          )}
        </motion.div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          登录即代表同意{" "}
          <button
            type="button"
            onClick={() => setLegalModal("terms")}
            className="text-primary hover:underline"
          >
            用户协议
          </button>
          {" "}和{" "}
          <button
            type="button"
            onClick={() => setLegalModal("privacy")}
            className="text-primary hover:underline"
          >
            隐私政策
          </button>
        </div>
      </div>

      {/* Legal modals */}
      {legalModal === "terms" && (
        <LegalModal
          title="用户协议"
          content={legalContent.termsOfService}
          onClose={() => setLegalModal(null)}
        />
      )}
      {legalModal === "privacy" && (
        <LegalModal
          title="隐私政策"
          content={legalContent.privacyPolicy}
          onClose={() => setLegalModal(null)}
        />
      )}
    </div>
  );
}
