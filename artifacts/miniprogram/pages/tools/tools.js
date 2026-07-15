const api = require("../../utils/api");
const { track, toolClickPageKey } = require("../../utils/track");

Page({
  data: {
    toolGroups: [],
    loadingTools: false,
    totalUseCount: 0,
  },

  onShow() {
    this._loadTools();
    this._loadStats();
  },

  _getAppKey() {
    var appKey = "birthday_mp";
    try {
      var app = getApp();
      appKey = (app && app.globalData && app.globalData.appKey) || appKey;
    } catch (e) { /* ignore */ }
    return appKey;
  },

  _toAbsIcon(icon) {
    if (!icon) return icon;
    if (icon.indexOf("http") === 0) return icon;
    if (icon.indexOf("/api/") === 0) {
      const base = (getApp().globalData.apiBase || "").replace(/\/$/, "");
      return base + icon;
    }
    return icon;
  },

  _mapTool(t) {
    var absIcon = this._toAbsIcon(t.icon);
    return {
      id: t.id,
      name: t.name,
      description: t.description || "",
      icon: absIcon,
      iconIsUrl: !!(absIcon && absIcon.indexOf("http") === 0),
      path: t.path || "",
      type: t.type || "internal",
      app_id: t.app_id || "",
      page_path: t.page_path || "",
    };
  },

  _loadStats() {
    var self = this;
    var appKey = this._getAppKey();
    api.get("api/mp-tools/public-stats?app_key=" + appKey)
      .then(function (data) {
        if (!data) return;
        var total = 0;
        for (var key in data) {
          total += Number(data[key]) || 0;
        }
        self.setData({ totalUseCount: total });
      })
      .catch(function () {});
  },

  _loadTools() {
    this.setData({ loadingTools: true });
    var self = this;
    var appKey = this._getAppKey();

    api.get("api/mp-tools/categories?app_key=" + appKey)
      .then(function(data) {
        var cats = (data && data.categories) || [];
        var groups = cats.map(function(cat) {
          return {
            id: cat.id,
            name: cat.name,
            icon: cat.icon || "",
            tools: (cat.tools || []).map(function(t) { return self._mapTool(t); }),
          };
        }).filter(function(g) { return g.tools.length > 0; });
        self.setData({ toolGroups: groups });
      })
      .catch(function() {
        api.get("api/mp-tools?app_key=" + appKey)
          .then(function(list) {
            var tools = (Array.isArray(list) ? list : []).map(function(t) { return self._mapTool(t); });
            self.setData({
              toolGroups: tools.length > 0
                ? [{ id: null, name: "全部工具", icon: "🔧", tools: tools }]
                : [],
            });
          })
          .catch(function() { self.setData({ toolGroups: [] }); });
      })
      .finally(function() {
        self.setData({ loadingTools: false });
      });
  },

  tapDynamicTool(e) {
    var ds = e.currentTarget.dataset;
    var toolId = ds.id;
    var type = ds.type || "internal";
    var path = (ds.path || "").trim();
    var appId = ds.appId || "";
    var pagePath = ds.pagePath || "";
    if (!toolId) return;

    var pageKey = toolClickPageKey(toolId);
    if (pageKey) track("tool_click", { page: pageKey });

    if (type === "external") {
      if (!appId) {
        wx.showToast({ title: "未配置目标小程序", icon: "none" });
        return;
      }
      wx.navigateToMiniProgram({
        appId: appId,
        path: pagePath || undefined,
        fail: function() {
          wx.showToast({ title: "跳转失败", icon: "none" });
        },
      });
      return;
    }

    if (!path || path === "#") {
      wx.showToast({ title: "页面路径未配置", icon: "none" });
      return;
    }
    if (path.charAt(0) !== "/") path = "/" + path;
    wx.navigateTo({
      url: path,
      fail: function() {
        wx.switchTab({
          url: path,
          fail: function() {
            wx.showToast({ title: "页面打开失败", icon: "none" });
          },
        });
      },
    });
  },
});
