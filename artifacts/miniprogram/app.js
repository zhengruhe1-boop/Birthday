const { API_BASE } = require('./config');

App({
  globalData: {
    apiBase: API_BASE,
    userInfo: null,
    token: null,
    sessionReady: null,
  },

  onLaunch() {
    const stored = wx.getStorageSync('birthday_token');
    if (stored) this.globalData.token = stored;

    this.globalData.sessionReady = this._silentLogin();
  },

  // 无感知自动登录：仅对已有 token 的老用户静默刷新 session
  // 新用户（无 token）直接返回 false，强制走授权登录页
  _silentLogin() {
    const self = this;
    const existingToken = wx.getStorageSync('birthday_token');

    // ── 新用户：没有历史 token，必须手动点击授权登录 ──────────────────────────
    if (!existingToken) {
      return Promise.resolve(false);
    }

    // ── 老用户：用 wx.login code 静默刷新 token，保持长期在线 ─────────────────
    return new Promise(function(resolve) {
      wx.login({
        timeout: 12000,
        success: function(loginRes) {
          const base = (self.globalData.apiBase || '').replace(/\/$/, '');
          wx.request({
            url: base + '/api/auth/wechat/login',
            method: 'POST',
            data: { code: loginRes.code },
            header: { 'Content-Type': 'application/json' },
            timeout: 15000,
            success: function(r) {
              if (r.statusCode >= 200 && r.statusCode < 300 && r.data && r.data.token) {
                wx.setStorageSync('birthday_token', r.data.token);
                self.globalData.token = r.data.token;
                if (r.data.user) wx.setStorageSync('birthday_userinfo', r.data.user);
                resolve(true);
              } else {
                // 刷新失败：保留老 token，让页面级鉴权决定是否踢回登录
                resolve(!!existingToken);
              }
            },
            fail: function() {
              // 网络异常：保留老 token 维持登录态
              resolve(!!existingToken);
            },
          });
        },
        fail: function() {
          resolve(!!existingToken);
        },
      });
    });
  },
});
