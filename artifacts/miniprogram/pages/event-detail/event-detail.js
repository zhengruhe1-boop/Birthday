const api = require("../../utils/api");
const { resolveLoggedIn } = require("../../utils/auth");
const { getShareAppMessage } = require("../../utils/share");

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
    deleting: false,
  },

  async onLoad(opts) {
    if (!(await resolveLoggedIn())) {
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
    } catch (err) {
      if (err && err.statusCode === 404) {
        this.setData({ loading: false, event: null });
        wx.navigateBack();
        return;
      }
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

  handleDelete() {
    const name = (this.data.event && this.data.event.name) || "该事件";
    wx.showModal({
      title: "删除事件",
      content: '确定要删除"' + name + '"吗？',
      confirmText: "删除",
      confirmColor: "#ef4444",
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ deleting: true });
        try {
          await api.del("api/events/" + this.data.eventId);
          wx.showToast({ title: "已删除", icon: "success" });
          setTimeout(() => wx.navigateBack(), 800);
        } catch {
          wx.showToast({ title: "删除失败", icon: "none" });
          this.setData({ deleting: false });
        }
      },
    });
  },

  handleBack() {
    wx.navigateBack();
  },

  onShareAppMessage() {
    return getShareAppMessage();
  },
});
