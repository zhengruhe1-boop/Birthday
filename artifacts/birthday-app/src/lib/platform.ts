export type Platform = "miniprogram" | "wechat_mp" | "h5";

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "h5";
  const ua = navigator.userAgent.toLowerCase();
  const inWeChat = ua.includes("micromessenger");

  if (inWeChat) {
    // Mini-program webview sets this global flag
    try {
      if (
        (window as any).__wxjs_environment === "miniprogram" ||
        (window as any).wx?.miniProgram
      ) {
        return "miniprogram";
      }
    } catch {
      // ignore
    }
    // WeChat browser but not mini-program
    return "wechat_mp";
  }
  return "h5";
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
