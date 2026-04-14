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

  // 无感知自动登录：每次启动都用 wx.login() code 换取最新 token
  // 解决：重新进入 / 预览 / 体验版 导致退出登录的问题
  _silentLogin() {
    const self = this;
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
                resolve(!!self.globalData.token);
              }
            },
            fail: function() {
              resolve(!!self.globalData.token);
            },
          });
        },
        fail: function() {
          resolve(!!self.globalData.token);
        },
      });
    });
  },
});
