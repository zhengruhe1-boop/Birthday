const { isLoggedIn } = require("../../utils/auth");

Page({
  data: {
    loggedIn: false,
  },

  onShow() {
    this.setData({ loggedIn: isLoggedIn() });
  },

  _requireLogin(hint) {
    wx.showModal({
      title: "需要登录",
      content: hint + "需要先登录，是否前往登录？",
      confirmText: "去登录",
      cancelText: "取消",
      success: (res) => {
        if (res.confirm) wx.navigateTo({ url: "/pages/login/login" });
      },
    });
  },

  goAddContact() {
    if (!this.data.loggedIn) { this._requireLogin("添加生日"); return; }
    wx.navigateTo({ url: "/pages/contact-form/contact-form?id=new" });
  },

  goAddAnniversary() {
    if (!this.data.loggedIn) { this._requireLogin("添加纪念日"); return; }
    wx.navigateTo({ url: "/pages/event-form/event-form?type=anniversary" });
  },

  goAddCountdown() {
    if (!this.data.loggedIn) { this._requireLogin("添加倒数日"); return; }
    wx.navigateTo({ url: "/pages/event-form/event-form?type=countdown" });
  },

  goAddOther() {
    if (!this.data.loggedIn) { this._requireLogin("其它提醒"); return; }
    wx.navigateTo({ url: "/pages/event-form/event-form?type=other" });
  },
});
