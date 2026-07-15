const api = require("../../utils/api");
const { track, toolClickPageKey } = require("../../utils/track");
const { ensureLoggedIn } = require("../../utils/auth");

Page({
  data: {
    toolGroups: [],
    loading: true,
  },

  onLoad() {
    if (!ensureLoggedIn({ from: "tools", redirect: "/pages/tools/tools" })) return;
    track("page_view", { page: "tools" });
  },

  onShow() {
    this._loadTools();
  },

  _toAbsIcon(icon) {
    if (!icon) return icon;
    if (icon.indexOf("http") === 0) return icon;
    if (icon.indexOf("/api/") === 0) {
      var base = (getApp().globalData.apiBase || "").replace(/\/$/, "");
      return base + icon;
    }
    return icon;
  },

  _loadTools() {
    this.setData({ loading: true });
    var self = this;
    api.get("api/mp-tools/categories?app_key=xishi_toolbox_mp")
      .then(function(data) {
        var cats = (data && data.categories) || [];
        var groups = cats.map(function(cat) {
          var tools = (cat.tools || []).map(function(t) {
            var absIcon = self._toAbsIcon(t.icon);
            return {
              id: t.id,
              name: t.name,
              desc: t.description || "",
              icon: absIcon,
              iconIsUrl: !!(absIcon && absIcon.indexOf("http") === 0),
              path: t.path || "",
              type: t.type || "internal",
              app_id: t.app_id || "",
              page_path: t.page_path || "",
            };
          });
          return {
            id: cat.id,
            name: cat.name,
            icon: cat.icon || "",
            tools: tools,
          };
        }).filter(function(g) { return g.tools.length > 0; });
        self.setData({ toolGroups: groups });
      })
      .catch(function() {
        self.setData({ toolGroups: [] });
      })
      .finally(function() {
        self.setData({ loading: false });
      });
  },

  openTool(e) {
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
        fail: function() { wx.showToast({ title: "跳转失败", icon: "none" }); },
      });
      return;
    }

    if (!path) {
      wx.showToast({ title: "页面路径未配置", icon: "none" });
      return;
    }
    if (path.charAt(0) !== "/") path = "/" + path;

    if (!ensureLoggedIn({ from: "tools", redirect: path, message: "请先登录后使用", delay: 300 })) {
      return;
    }

    wx.navigateTo({
      url: path,
      fail: function() { wx.switchTab({ url: path }); },
    });
  },
});
