const api = require("../../utils/api");
const { isLoggedIn } = require("../../utils/auth");

Page({
  data: {
    loading: false,
    unhiding: {},   // { [id]: true } 正在处理中的 id
    events: [],
  },

  onLoad() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }
    this.load();
  },

  onShow() {
    if (isLoggedIn()) this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      var list = await api.get("api/contacts/hidden");
      var events = (list || []).map(function(c) {
        var gender = c.gender || "";
        var bg    = gender === "female" ? "#fce7f3" : "#e0f2fe";
        var color = gender === "female" ? "#db2777" : "#0284c7";
        var lunar = c.birthdayLunar ? "（农历）" : "";
        var sub   = c.birthdayMonth + "月" + c.birthdayDay + "日" + lunar
          + (c.relation ? " · " + c.relation : "");
        return {
          id: c.id,
          name: c.name,
          avatarUrl: c.avatarUrl || "",
          color: color,
          bg: bg,
          sub: sub,
        };
      });
      this.setData({ events: events, unhiding: {} });
    } catch(err) {
      wx.showToast({ title: "加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  goEdit(e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: "/pages/contact-form/contact-form?id=" + id });
  },

  // 直接取消隐藏，不跳转编辑页
  async unhide(e) {
    var id = e.currentTarget.dataset.id;
    if (this.data.unhiding[id]) return;

    // 标记 loading
    var unhiding = Object.assign({}, this.data.unhiding);
    unhiding[id] = true;
    this.setData({ unhiding: unhiding });

    try {
      await api.put("api/contacts/" + id, { hidden: false });
      // 从列表中移除
      var events = this.data.events.filter(function(item) { return item.id !== id; });
      var u = Object.assign({}, this.data.unhiding);
      delete u[id];
      this.setData({ events: events, unhiding: u });
      wx.showToast({ title: "已展示到首页", icon: "success" });
    } catch(err) {
      var u2 = Object.assign({}, this.data.unhiding);
      delete u2[id];
      this.setData({ unhiding: u2 });
      wx.showToast({ title: "操作失败，请重试", icon: "none" });
    }
  },
});
