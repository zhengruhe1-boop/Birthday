var api = require("../../utils/api");
var { isLoggedIn } = require("../../utils/auth");
var { getShareAppMessage } = require("../../utils/share");

Page({
  data: {
    loading: true,
    claiming: false,
    config: null,
    sharePending: false, // 已点击分享，等待返回后自动领取
    mpShown: false,
  },

  onLoad: function() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }
    this.loadConfig();
  },

  onShow: function() {
    // 从跳转小程序返回：自动领取
    if (this.data.mpShown) {
      this.setData({ mpShown: false });
      this.doClaim("miniprogram");
      return;
    }
    // 从分享面板返回：自动领取
    if (this.data.sharePending) {
      this.setData({ sharePending: false });
      this.doClaim("share");
    }
  },

  loadConfig: async function() {
    try {
      var cfg = await api.get("api/quota/config");
      this.setData({ config: cfg, loading: false });
      wx.setNavigationBarTitle({ title: "\u89e3\u9501\u66f4\u591a\u6b21\u6570" });
    } catch(err) {
      this.setData({ loading: false });
      wx.showToast({ title: "\u52a0\u8f7d\u5931\u8d25", icon: "none" });
    }
  },

  onShareAppMessage: function() {
    return getShareAppMessage();
  },

  tapShare: function() {
    // open-type="share" 会自动弹出分享面板；这里仅标记"等待返回后领取"
    this.setData({ sharePending: true });
  },

  watchVideo: function() {
    var cfg = this.data.config;
    if (!cfg || !cfg.videoAdId) {
      wx.showToast({ title: "\u89c6\u9891\u5e7f\u544a\u672a\u914d\u7f6e", icon: "none" });
      return;
    }
    var self = this;
    try {
      var ad = wx.createRewardedVideoAd({ adUnitId: cfg.videoAdId });
      ad.onError(function() {
        wx.showToast({ title: "\u5e7f\u544a\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5", icon: "none" });
      });
      ad.onClose(function(res) {
        if (res && res.isEnded) {
          self.doClaim("video");
        } else {
          wx.showToast({ title: "\u8bf7\u5b8c\u6574\u89c2\u770b\u5e7f\u544a", icon: "none" });
        }
      });
      ad.show().catch(function() {
        wx.showToast({ title: "\u5e7f\u544a\u52a0\u8f7d\u5931\u8d25", icon: "none" });
      });
    } catch(e) {
      wx.showToast({ title: "\u5e7f\u544a\u4e0d\u652f\u6301\uff0c\u8bf7\u5347\u7ea7\u5fae\u4fe1", icon: "none" });
    }
  },

  jumpMiniprogram: function() {
    var cfg = this.data.config;
    if (!cfg || !cfg.mpAppId) {
      wx.showToast({ title: "\u5c0f\u7a0b\u5e8f\u672a\u914d\u7f6e", icon: "none" });
      return;
    }
    this.setData({ mpShown: true });
    wx.navigateToMiniProgram({
      appId: cfg.mpAppId,
      path: cfg.mpPath || "",
      fail: function() {
        wx.showToast({ title: "\u8df3\u8f6c\u5931\u8d25", icon: "none" });
      },
    });
  },

  doClaim: async function(action) {
    if (this.data.claiming) return;
    this.setData({ claiming: true });
    try {
      var result = await api.post("api/quota/claim", { action: action });
      var added = (result && result.added) ? result.added : (this.data.config && this.data.config.perAction) || 5;
      wx.showToast({
        title: "\u5206\u4eab\u6210\u529f\uff01\u60a8\u5df2\u83b7\u5f97 " + added + " \u6b21\u989d\u5916\u6dfb\u52a0\u673a\u4f1a",
        icon: "success",
        duration: 2000,
      });
      var self = this;
      setTimeout(function() {
        wx.redirectTo({ url: "/pages/contact-form/contact-form" });
      }, 2000);
    } catch(err) {
      this.setData({ claiming: false });
      var msg = (err && err.message) || "\u9886\u53d6\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5";
      wx.showToast({ title: msg, icon: "none" });
    }
  },
});
