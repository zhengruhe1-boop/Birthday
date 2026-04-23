export type Platform = "miniprogram" | "wechat_mp" | "h5";

const SESSION_KEY = "birthday_platform";

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "h5";
  const ua = navigator.userAgent.toLowerCase();
  const inWeChat = ua.includes("micromessenger");

  if (!inWeChat) return "h5";

  // 优先使用 sessionStorage 中缓存的结果（同一会话内保持一致）
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached === "miniprogram") return "miniprogram";
  } catch { /* ignore */ }

  // 检测小程序 WebView 标志（仅 __wxjs_environment，wx.miniProgram 在公众号 H5 也存在，不可用于区分）
  try {
    if ((window as any).__wxjs_environment === "miniprogram") {
      try { sessionStorage.setItem(SESSION_KEY, "miniprogram"); } catch { /* ignore */ }
      return "miniprogram";
    }
  } catch { /* ignore */ }

  return "wechat_mp";
}

/**
 * 异步检测：延迟若干毫秒后再次检测，捕获小程序 WebView 异步注入的 __wxjs_environment。
 * 返回最终 Platform，如果是 miniprogram 会同时写入 sessionStorage。
 */
export function detectPlatformAsync(delayMs = 400): Promise<Platform> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(detectPlatform());
    }, delayMs);
  });
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  h5: "H5 网页端",
  wechat_mp: "微信公众号",
  miniprogram: "微信小程序",
};

export const PLATFORM_ICON: Record<Platform, string> = {
  h5: "🌐",
  wechat_mp: "💬",
  miniprogram: "📱",
};

export const PLATFORM_COLOR: Record<Platform, string> = {
  h5: "bg-blue-50 text-blue-600 border-blue-100",
  wechat_mp: "bg-green-50 text-green-700 border-green-100",
  miniprogram: "bg-teal-50 text-teal-700 border-teal-100",
};
