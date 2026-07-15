const api = require("../../utils/api");
const { setSession, isLoggedIn } = require("../../utils/auth");
const { track } = require("../../utils/track");

Page({
  data: {
    agreed: false,
    loading: false,
    error: "",
  },

  onLoad(options) {
    this._from = options.from || "home";
    this._afterLoginTab = this._from === "profile" ? "/pages/profile/profile" : "/pages/home/home";
    this._redirect = options.redirect ? decodeURIComponent(options.redirect) : "";
    track("page_view", { page: "login" });
    if (isLoggedIn()) {
      this._goAfterLogin();
    }
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed, error: "" });
  },

  async login() {
    if (this.data.loading) return;
    if (!this.data.agreed) {
      wx.showToast({ title: "请先同意协议", icon: "none" });
      return;
    }

    this.setData({ loading: true, error: "" });
    try {
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({ timeout: 10000, success: resolve, fail: reject });
      });
      const app = getApp();
      const appKey = (app && app.globalData.appKey) || "xishi_toolbox_mp";
      const res = await api.post("api/auth/wechat/login", {
        code: loginRes.code,
        appKey,
      });
      setSession(res.token, res.user);
      this._goAfterLogin();
    } catch (err) {
      this.setData({ error: err.message || "登录失败，请稍后重试" });
    } finally {
      this.setData({ loading: false });
    }
  },

  openTerms() {
    wx.navigateTo({ url: "/pages/legal/legal?type=terms" });
  },

  openPrivacy() {
    wx.navigateTo({ url: "/pages/legal/legal?type=privacy" });
  },

  _goAfterLogin() {
    if (this._redirect) {
      wx.redirectTo({
        url: this._redirect,
        fail: () => {
          wx.navigateTo({
            url: this._redirect,
            fail: () => wx.switchTab({ url: this._afterLoginTab || "/pages/home/home" }),
          });
        },
      });
      return;
    }
    wx.switchTab({ url: this._afterLoginTab || "/pages/home/home" });
  },
});
