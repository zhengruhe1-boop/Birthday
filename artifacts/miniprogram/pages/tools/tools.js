const { isLoggedIn } = require("../../utils/auth");
const api = require("../../utils/api");

Page({
  data: {
    loggedIn: false,
    dynamicTools: [],
    loadingTools: false,
    dateCalcEnabled: false,
    dateCalcIcon: '🗓️',
    dateCalcIconIsUrl: false,
    ageCalcEnabled: false,
    ageCalcIcon: '🎂',
    ageCalcIconIsUrl: false,
  },

  onShow() {
    this.setData({ loggedIn: isLoggedIn() });
    this._loadTools();
    this._loadBuiltin();
  },

  _toAbsIcon(icon) {
    if (!icon) return icon;
    if (icon.indexOf('http') === 0) return icon;
    if (icon.indexOf('/api/') === 0) {
      const base = (getApp().globalData.apiBase || '').replace(/\/$/, '');
      return base + icon;
    }
    return icon;
  },

  _loadTools() {
    this.setData({ loadingTools: true });
    api.get("api/mp-tools")
      .then((list) => {
        const self = this;
        const tools = (Array.isArray(list) ? list : []).map(function(t) {
          const absIcon = self._toAbsIcon(t.icon);
          return Object.assign({}, t, {
            icon: absIcon,
            iconIsUrl: !!(absIcon && (absIcon.indexOf('http') === 0)),
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
    api.get("api/mp-tools/builtin")
      .then((data) => {
        var dcIcon = this._toAbsIcon((data && data.date_calc_icon) || '🗓️');
        var dcIsUrl = !!(dcIcon && dcIcon.indexOf('http') === 0);
        var acIcon = this._toAbsIcon((data && data.age_calc_icon) || '🎂');
        var acIsUrl = !!(acIcon && acIcon.indexOf('http') === 0);
        this.setData({
          dateCalcEnabled: data && data.date_calc !== false,
          dateCalcIcon: dcIcon,
          dateCalcIconIsUrl: dcIsUrl,
          ageCalcEnabled: data && data.age_calc !== false,
          ageCalcIcon: acIcon,
          ageCalcIconIsUrl: acIsUrl,
        });
      })
      .catch(() => {
        this.setData({
          dateCalcEnabled: true, dateCalcIcon: '🗓️', dateCalcIconIsUrl: false,
          ageCalcEnabled: true, ageCalcIcon: '🎂', ageCalcIconIsUrl: false,
        });
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

  goAgeCalc() {
    wx.navigateTo({ url: "/pages/age-calc/age-calc" });
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
