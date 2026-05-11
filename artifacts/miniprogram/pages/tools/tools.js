const { isLoggedIn } = require("../../utils/auth");
const api = require("../../utils/api");

Page({
  data: {
    loggedIn: false,
    dynamicTools: [],
    loadingTools: false,
    dateCalcEnabled: false,
  },

  onShow() {
    this.setData({ loggedIn: isLoggedIn() });
    this._loadTools();
    this._loadBuiltin();
  },

  _loadTools() {
    this.setData({ loadingTools: true });
    api.get("/mp-tools")
      .then((list) => {
        const tools = (Array.isArray(list) ? list : []).map(function(t) {
          return Object.assign({}, t, {
            iconIsUrl: !!(t.icon && (t.icon.indexOf('http') === 0 || t.icon.indexOf('/api/') === 0)),
          });
        });
        this.setData({ dynamicTools: tools });
      })
      .catch(() => {
        this.setData({ dynamicTools: [] });
      })
      .finally(() => {
        this.setData({ loadingTools: false });
      });
  },

  _loadBuiltin() {
    api.get("/mp-tools/builtin")
      .then((data) => {
        this.setData({ dateCalcEnabled: data && data.date_calc !== false });
      })
      .catch(() => {
        this.setData({ dateCalcEnabled: true });
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

  goDateCalc() {
    wx.navigateTo({ url: "/pages/date-calc/date-calc" });
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
