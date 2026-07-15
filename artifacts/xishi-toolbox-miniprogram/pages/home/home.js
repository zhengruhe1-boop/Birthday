var api = require("../../utils/api");
var trackUtil = require("../../utils/track");
var auth = require("../../utils/auth");

function filterToolGroups(allGroups, query) {
  var q = (query || "").trim().toLowerCase();
  var source = allGroups || [];
  if (!q) {
    return { groups: source, noResult: false };
  }
  var groups = source.map(function (group) {
    var tools = group.tools.filter(function (t) {
      var name = (t.name || "").toLowerCase();
      var desc = (t.desc || "").toLowerCase();
      return name.indexOf(q) >= 0 || desc.indexOf(q) >= 0;
    });
    return {
      id: group.id,
      name: group.name,
      icon: group.icon,
      tools: tools,
    };
  }).filter(function (g) { return g.tools.length > 0; });
  return { groups: groups, noResult: groups.length === 0 };
}

function syncSearchView(page, allGroups, query) {
  var result = filterToolGroups(allGroups, query);
  page.setData({
    toolGroups: result.groups,
    searchNoResult: result.noResult,
  });
}

function buildSearchPlaceholder(focused, query, count) {
  if (focused || (query && query.trim())) return "";
  return "工具箱已累计帮助了 " + (count || 0) + " 人次";
}

Page({
  data: {
    appName: "惜时工具箱",
    enabled: true,
    toolGroups: [],
    loading: true,
    totalUseCount: 0,
    searchQuery: "",
    searchFocused: false,
    searchPlaceholder: "工具箱已累计帮助了 0 人次",
    searchNoResult: false,
  },

  onLoad: function () {
    this.applyPublicConfig();
    this._loadTools();
    this._loadStats();
    trackUtil.track("page_view", { page: "home" });
  },

  onShow: function () {
    this._loadTools();
  },

  applyPublicConfig: function () {
    var app = getApp();
    var cfg = app && app.globalData.publicConfig;
    if (!cfg) return;

    this.setData({
      appName: (cfg.app && cfg.app.name) || this.data.appName,
      enabled: cfg.app ? cfg.app.enabled !== false : true,
    });
  },

  _toAbsIcon: function (icon) {
    if (!icon) return icon;
    if (icon.indexOf("http") === 0) return icon;
    if (icon.indexOf("/api/") === 0) {
      var base = (getApp().globalData.apiBase || "").replace(/\/$/, "");
      return base + icon;
    }
    return icon;
  },

  _loadTools: function () {
    this.setData({ loading: true });
    var self = this;
    api.get("api/mp-tools/categories?app_key=xishi_toolbox_mp")
      .then(function (data) {
        var cats = (data && data.categories) || [];
        var groups = cats.map(function (cat) {
          var tools = (cat.tools || []).map(function (t) {
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
        }).filter(function (g) { return g.tools.length > 0; });
        self._allToolGroups = groups;
        syncSearchView(self, groups, self.data.searchQuery);
        self.setData({ loadError: "" });
      })
      .catch(function (err) {
        console.error("[home] _loadTools failed:", err && err.message ? err.message : err);
        self._allToolGroups = [];
        self.setData({
          toolGroups: [],
          loadError: (err && err.message) || "加载失败",
          searchNoResult: false,
        });
      })
      .finally(function () {
        self.setData({ loading: false });
      });
  },

  _loadStats: function () {
    var self = this;
    api.get("api/mp-tools/public-stats?app_key=xishi_toolbox_mp")
      .then(function (data) {
        if (!data) return;
        var total = 0;
        for (var key in data) {
          total += Number(data[key]) || 0;
        }
        self.setData({
          totalUseCount: total,
          searchPlaceholder: buildSearchPlaceholder(self.data.searchFocused, self.data.searchQuery, total),
        });
      })
      .catch(function () {});
  },

  onSearchInput: function (e) {
    var query = (e.detail && e.detail.value) || "";
    this.setData({
      searchQuery: query,
      searchPlaceholder: buildSearchPlaceholder(this.data.searchFocused, query, this.data.totalUseCount),
    });
    syncSearchView(this, this._allToolGroups || [], query);
  },

  onSearchFocus: function () {
    this.setData({
      searchFocused: true,
      searchPlaceholder: buildSearchPlaceholder(true, this.data.searchQuery, this.data.totalUseCount),
    });
  },

  onSearchBlur: function () {
    this.setData({
      searchFocused: false,
      searchPlaceholder: buildSearchPlaceholder(false, this.data.searchQuery, this.data.totalUseCount),
    });
  },

  onSearchClear: function () {
    this.setData({
      searchQuery: "",
      searchPlaceholder: buildSearchPlaceholder(this.data.searchFocused, "", this.data.totalUseCount),
    });
    syncSearchView(this, this._allToolGroups || [], "");
  },

  goTool: function (e) {
    var ds = e.currentTarget.dataset;
    var toolId = ds.id;
    var path = (ds.path || "").trim();
    var type = ds.type || "internal";
    var appId = ds.appId || "";
    var pagePath = ds.pagePath || "";

    var pageKey = trackUtil.toolClickPageKey(toolId);
    if (pageKey) trackUtil.track("tool_click", { page: pageKey });

    if (type === "external") {
      if (!appId) {
        wx.showToast({ title: "未配置目标小程序", icon: "none" });
        return;
      }
      wx.navigateToMiniProgram({
        appId: appId,
        path: pagePath || undefined,
        fail: function () { wx.showToast({ title: "跳转失败", icon: "none" }); },
      });
      return;
    }

    if (!path || path === "#") {
      wx.showToast({ title: "页面路径未配置", icon: "none" });
      return;
    }
    if (path.charAt(0) !== "/") path = "/" + path;

    if (!auth.isLoggedIn()) {
      auth.ensureLoggedIn({
        from: "home",
        redirect: path,
        message: "请先登录后使用",
        delay: 300,
      });
      return;
    }

    wx.navigateTo({
      url: path,
      fail: function () {
        wx.switchTab({
          url: path,
          fail: function () {
            wx.showToast({ title: "页面打开失败", icon: "none" });
          },
        });
      },
    });
  },

  _getShareConfig: function () {
    var app = getApp();
    var cfg = app && app.globalData.publicConfig;
    var share = (cfg && cfg.share) || {};
    var base = ((app && app.globalData.apiBase) || "").replace(/\/$/, "");
    var imageUrl = share.imageUrl || "";
    if (imageUrl && imageUrl.indexOf("/api/") === 0 && base) {
      imageUrl = base + imageUrl;
    }
    return {
      title: share.title || "惜时工具箱",
      path: share.path || "/pages/home/home",
      imageUrl: imageUrl,
    };
  },

  onShareAppMessage: function () {
    var share = this._getShareConfig();
    var result = {
      title: share.title,
      path: share.path,
    };
    if (share.imageUrl) result.imageUrl = share.imageUrl;
    return result;
  },

  onShareTimeline: function () {
    var share = this._getShareConfig();
    var result = {
      title: share.title,
    };
    if (share.imageUrl) result.imageUrl = share.imageUrl;
    return result;
  },
});
