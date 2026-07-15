const api = require("../../utils/api");
const { resolveLoggedIn } = require("../../utils/auth");
const { getShareAppMessage } = require("../../utils/share");

const STATUS_LABELS = {
  pending: "待处理",
  processing: "处理中",
  resolved: "已解决",
};

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

Page({
  data: {
    loading: true,
    list: [],
  },

  async onShow() {
    const loggedIn = await resolveLoggedIn();
    if (!loggedIn) {
      wx.showToast({ title: "请先登录", icon: "none" });
      setTimeout(() => wx.navigateTo({ url: "/pages/login/login" }), 500);
      return;
    }
    this.loadList();
  },

  loadList() {
    this.setData({ loading: true });
    api.get("api/messages")
      .then((res) => {
        const list = (res.messages || []).map((item) => {
          const isAnnouncement = item.type === "announcement";
          return {
            ...item,
            statusLabel: isAnnouncement
              ? "官方消息"
              : (STATUS_LABELS[item.status] || item.status || "反馈"),
            statusClass: isAnnouncement ? "announcement" : (item.status || "pending"),
            timeText: formatTime(item.createdAt),
            displayTitle: isAnnouncement ? item.title : "问题反馈",
            displayPreview: item.preview || "",
          };
        });
        this.setData({ list, loading: false });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: "加载失败", icon: "none" });
      });
  },

  goDetail(e) {
    const { id, type } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/message-detail/message-detail?type=${type || "feedback"}&id=${id}`,
    });
  },

  onShareAppMessage() {
    return getShareAppMessage();
  },
});
