const { API_BASE, APP_KEY } = require("./config");
const { track } = require("./utils/track");

App({
  globalData: {
    apiBase: API_BASE,
    appKey: APP_KEY,
    token: null,
    userInfo: null,
    publicConfig: null,
    sessionReady: null,
  },

  onLaunch() {
    const token = wx.getStorageSync("xishi_token") || "";
    if (token) this.globalData.token = token;

    this.globalData.sessionReady = this._verifySession(token);
    this.loadPublicConfig();
    track("app_launch", { page: "app" });
  },

  loadPublicConfig() {
    const base = (this.globalData.apiBase || "").replace(/\/$/, "");
    return new Promise((resolve) => {
      wx.request({
        url: `${base}/api/apps/${this.globalData.appKey}/public-config`,
        method: "GET",
        header: { "x-app-key": this.globalData.appKey },
        timeout: 10000,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            this.globalData.publicConfig = res.data || null;
            resolve(res.data || null);
            return;
          }
          resolve(null);
        },
        fail: () => resolve(null),
      });
    });
  },

  _verifySession(token) {
    if (!token) return Promise.resolve(false);

    const base = (this.globalData.apiBase || "").replace(/\/$/, "");
    return new Promise((resolve) => {
      wx.request({
        url: `${base}/api/auth/me`,
        method: "GET",
        header: {
          Authorization: `Bearer ${token}`,
          "x-app-key": this.globalData.appKey,
        },
        timeout: 8000,
        success: (res) => {
          if (res.statusCode === 200 && res.data && res.data.id) {
            this.globalData.token = token;
            this.globalData.userInfo = res.data;
            wx.setStorageSync("xishi_userinfo", res.data);
            resolve(true);
            return;
          }
          wx.removeStorageSync("xishi_token");
          wx.removeStorageSync("xishi_userinfo");
          this.globalData.token = null;
          this.globalData.userInfo = null;
          resolve(false);
        },
        fail: () => resolve(true),
      });
    });
  },
});
