function track(eventType, extra) {
  try {
    const app = getApp();
    if (!app || !app.globalData || !app.globalData.apiBase) return;

    const base = (app.globalData.apiBase || "").replace(/\/$/, "");
    const appKey = app.globalData.appKey || "xishi_toolbox_mp";
    const token = wx.getStorageSync("xishi_token") || "";

    wx.request({
      url: `${base}/api/track`,
      method: "POST",
      data: Object.assign({ eventType, appKey, token }, extra || {}),
      header: { "x-app-key": appKey },
      timeout: 5000,
    });
  } catch {
    // 埋点不能影响用户操作
  }
}

/** 将工具 id 转为统计用的 page key（内置工具用 builtin:xxx，自研工具用 tool:id） */
function toolClickPageKey(toolId) {
  if (!toolId) return null;
  const id = String(toolId);
  if (id.indexOf("builtin_") === 0) {
    return "builtin:" + id.slice("builtin_".length);
  }
  return "tool:" + id;
}

module.exports = { track, toolClickPageKey };
