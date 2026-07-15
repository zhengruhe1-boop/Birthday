const api = require("../../utils/api");
const { getShareAppMessage, getShareTimeline } = require("../../utils/share");

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
    return getShareAppMessage();
  },

  onShareTimeline() {
    return getShareTimeline();
  },
});
