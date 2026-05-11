const api = require("../../utils/api");
const { isLoggedIn } = require("../../utils/auth");

var TYPE_META = {
  anniversary: { icon: "\u2764\ufe0f", color: "#f43f5e", bg: "#fff1f2", label: "\u7eaa\u5ff5\u65e5" },
  countdown:   { icon: "\u23f1\ufe0f", color: "#f97316", bg: "#fff7ed", label: "\u5012\u6570\u65e5" },
  other:       { icon: "\u2728",       color: "#8b5cf6", bg: "#f5f3ff", label: "\u5176\u5b83\u63d0\u9192" },
};

function buildSub(e) {
  if (e.type === "anniversary") {
    return (e.eventDate || "") + (e.person ? " \u00b7 " + e.person : "");
  }
  if (e.type === "countdown") {
    return e.eventDate ? "\u76ee\u6807\u65e5\u671f\uff1a" + e.eventDate : "";
  }
  if (e.type === "other") {
    return e.reminderTime ? "\u63d0\u9192\uff1a" + e.reminderTime : "";
  }
  return "";
}

Page({
  data: {
    loading: false,
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
        var bg = gender === "female" ? "#fce7f3" : "#e0f2fe";
        var color = gender === "female" ? "#db2777" : "#0284c7";
        var icon = "\ud83c\udf82";
        var lunar = c.birthdayLunar ? "(\u519c\u5386)" : "";
        var sub = c.birthdayMonth + "\u6708" + c.birthdayDay + "\u65e5" + lunar
          + (c.relation ? " \u00b7 " + c.relation : "");
        return { id: c.id, name: c.name, icon: icon, color: color, bg: bg, sub: sub };
      });
      this.setData({ events: events });
    } catch(err) {
      wx.showToast({ title: "\u52a0\u8f7d\u5931\u8d25", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  goEdit(e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: "/pages/contact-form/contact-form?id=" + id });
  },
});
