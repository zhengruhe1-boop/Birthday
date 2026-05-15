const api = require("../../utils/api");

Page({
  data: {
    oaSubscribed: false,
    checking: true,
  },

  onLoad() {
    this._checkSubscribed();
  },

  onShow() {
    this._checkSubscribed();
  },

  _checkSubscribed() {
    const self = this;
    api.get("api/auth/wechat/subscribe-status")
      .then(function(res) {
        self.setData({ oaSubscribed: !!(res && res.subscribed), checking: false });
      })
      .catch(function() {
        self.setData({ oaSubscribed: false, checking: false });
      });
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  onShareAppMessage() {
    return {
      title: "生日通.让您不再错过每个重要日子",
      path: "/pages/home/home",
      imageUrl: "/images/logo.jpg",
    };
  },

  onShareTimeline() {
    return {
      title: "生日通.让您不再错过每个重要日子",
      imageUrl: "/images/logo.jpg",
    };
  },
});
