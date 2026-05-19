const api = require("../../utils/api");
const { isLoggedIn } = require("../../utils/auth");

const TYPE_META = {
  anniversary: {
    label: "纪念日",
    icon: "❤️",
    color: "#f43f5e",
    bg: "#fff1f2",
    tagBg: "#fecdd3",
    tagColor: "#be123c",
  },
  countdown: {
    label: "倒数日",
    icon: "⏱️",
    color: "#f97316",
    bg: "#fff7ed",
    tagBg: "#fed7aa",
    tagColor: "#c2410c",
  },
  other: {
    label: "其它提醒",
    icon: "✨",
    color: "#8b5cf6",
    bg: "#f5f3ff",
    tagBg: "#ddd6fe",
    tagColor: "#6d28d9",
  },
};

Page({
  data: {
    loading: true,
    eventId: null,
    event: null,
    meta: TYPE_META.anniversary,
    daysText: "",
    dateLabel: "",
    dateValue: "",
  },

  async onLoad(opts) {
    const app = getApp();
    let loggedIn = false;
    if (app && app.globalData.sessionReady) {
      loggedIn = await app.globalData.sessionReady;
    } else {
      loggedIn = isLoggedIn();
    }
    if (!loggedIn) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }
    if (!opts.id) {
      wx.navigateBack();
      return;
    }
    this.setData({ eventId: parseInt(opts.id, 10) });
    await this.loadEvent(parseInt(opts.id, 10));
  },

  async onShow() {
    if (this.data.eventId && this._needRefresh) {
      this._needRefresh = false;
      await this.loadEvent(this.data.eventId);
    }
  },

  async loadEvent(id) {
    this.setData({ loading: true });
    try {
      const e = await api.get("api/events/" + id);
      const type = e.type || "anniversary";
      const meta = TYPE_META[type] || TYPE_META.anniversary;

      let dateLabel = "";
      let dateValue = "";
      let daysText = "";

      if (type === "anniversary") {
        dateLabel = "纪念日期";
        dateValue = e.eventDate || "";
        if (e.anniversaryYear !== undefined && e.anniversaryYear !== null) {
          const yr = e.anniversaryYear;
          if (e.daysUntil === 0) {
            daysText = "今天 · 第" + yr + "周年";
          } else if (e.daysUntil > 0) {
            daysText = e.daysUntil + " 天后 · 第" + yr + "周年";
          } else {
            daysText = "已过 " + Math.abs(e.daysUntil) + " 天";
          }
        } else if (e.daysUntil !== undefined) {
          daysText = e.daysUntil === 0 ? "今天" : e.daysUntil + " 天后";
        }
      } else if (type === "countdown") {
        dateLabel = "目标日期";
        dateValue = e.eventDate || "";
        if (e.daysUntil === 0) {
          daysText = "今天到期";
        } else if (e.daysUntil > 0) {
          daysText = "还有 " + e.daysUntil + " 天";
        } else {
          daysText = "已过期 " + Math.abs(e.daysUntil) + " 天";
        }
      } else {
        dateLabel = "提醒时间";
        dateValue = e.reminderTime || "";
        if (e.daysUntil !== undefined && e.daysUntil !== null) {
          if (e.daysUntil === 0) {
            daysText = "今天提醒";
          } else if (e.daysUntil > 0) {
            daysText = e.daysUntil + " 天后提醒";
          } else {
            daysText = "已过期";
          }
        }
      }

      wx.setNavigationBarTitle({ title: meta.label + "详情" });

      this.setData({
        event: e,
        meta,
        dateLabel,
        dateValue,
        daysText,
        loading: false,
      });
    } catch {
      wx.showToast({ title: "加载失败", icon: "none" });
      this.setData({ loading: false });
    }
  },

  goEdit() {
    this._needRefresh = true;
    wx.navigateTo({
      url: "/pages/event-form/event-form?id=" + this.data.eventId,
    });
  },

  handleBack() {
    wx.navigateBack();
  },

  onShareAppMessage() {
    return {
      title: "生日通.让您不再错过每个重要日子",
      path: "/pages/home/home",
      imageUrl: "/images/logo.jpg",
    };
  },
});
