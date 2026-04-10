const { API_BASE } = require('./config');

App({
  globalData: {
    apiBase: API_BASE,
    userInfo: null,
    token: null,
  },

  onLaunch() {
    const token = wx.getStorageSync('birthday_token');
    if (token) {
      this.globalData.token = token;
    }
  },
});
