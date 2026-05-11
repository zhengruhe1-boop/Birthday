const { isLoggedIn } = require("../../utils/auth");
const api = require("../../utils/api");

Page({
  data: {
    loggedIn: false,
    dynamicTools: [],
    loadingTools: false,
  },

  onShow() {
    this.setData({ loggedIn: isLoggedIn() });
    this._loadTools();
  },

  _loadTools() {
    this.setData({ loadingTools: true });
    api.get("/mp-tools")
      .then((list) => {
        this.setData({ dynamicTools: Array.isArray(list) ? list : [] });
      })
      .catch(() => {
        this.setData({ dynamicTools: [] });
      })
      .finally(() => {
        this.setData({ loadingTools: false });
      });
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

  tapDynamicTool(e) {
    const tool = e.currentTarget.dataset.tool;
    if (!tool) return;
    if (tool.type === "internal") {
      const path = tool.path;
      if (!path) return;
      wx.navigateTo({
        url: path,
        fail: () => wx.switchTab({ url: path }),
      });
    } else if (tool.type === "external") {
      if (!tool.app_id) return;
      wx.navigateToMiniProgram({
        appId: tool.app_id,
        path: tool.page_path || undefined,
        fail() {
          wx.showToast({ title: "跳转失败", icon: "none" });
        },
      });
    }
  },
});
