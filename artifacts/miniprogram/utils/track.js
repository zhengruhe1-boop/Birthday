/**
 * 轻量埋点工具 — 完全 fire-and-forget，不阻塞 UI
 * 任何异常均静默处理，不影响主流程
 */
function track(eventType, extra) {
  try {
    var app = getApp();
    if (!app || !app.globalData || !app.globalData.apiBase) return;
    var base = (app.globalData.apiBase || '').replace(/\/$/, '');
    var token = '';
    try { token = wx.getStorageSync('birthday_token') || ''; } catch (e) {}
    wx.request({
      url: base + '/api/track',
      method: 'POST',
      data: Object.assign({ eventType: eventType, token: token }, extra || {}),
      timeout: 5000,
    });
  } catch (e) {
    // never throw from track
  }
}

module.exports = { track: track };
