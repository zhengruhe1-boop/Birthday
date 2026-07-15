/**
 * 轻量埋点工具 — 完全 fire-and-forget，不阻塞 UI
 * 任何异常均静默处理，不影响主流程
 */
function track(eventType, extra) {
  try {
    var app = getApp();
    if (!app || !app.globalData || !app.globalData.apiBase) return;
    var base = (app.globalData.apiBase || '').replace(/\/$/, '');
    var appKey = app.globalData.appKey || 'birthday_mp';
    var token = '';
    try { token = wx.getStorageSync('birthday_token') || ''; } catch (e) {}
    wx.request({
      url: base + '/api/track',
      method: 'POST',
      data: Object.assign({ eventType: eventType, token: token, appKey: appKey }, extra || {}),
      header: { 'x-app-key': appKey },
      timeout: 5000,
    });
  } catch (e) {
    // never throw from track
  }
}

function toolClickPageKey(toolId) {
  if (!toolId) return null;
  var id = String(toolId);
  if (id.indexOf("builtin_") === 0) {
    return "builtin:" + id.slice("builtin_".length);
  }
  return "tool:" + id;
}

module.exports = { track: track, toolClickPageKey: toolClickPageKey };
