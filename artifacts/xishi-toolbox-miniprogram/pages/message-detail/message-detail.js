const api = require("../../utils/api");
const { isLoggedIn } = require("../../utils/auth");
const { mapImageUrls, prepareReplyHtml, hasHtmlContent } = require("../../utils/feedback-media");

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
    item: null,
    msgType: "feedback",
  },

  onLoad(options) {
    if (!isLoggedIn()) {
      wx.showToast({ title: "请先登录", icon: "none" });
      setTimeout(() => wx.navigateTo({ url: "/pages/login/login?from=message-detail" }), 500);
      return;
    }
    const id = options.id;
    const type = options.type === "announcement" ? "announcement" : "feedback";
    this.setData({ msgType: type });
    wx.setNavigationBarTitle({
      title: type === "announcement" ? "消息详情" : "反馈详情",
    });
    if (!id) return;
    this.loadDetail(type, id);
  },

  loadDetail(type, id) {
    wx.showLoading({ title: "加载中" });
    const path =
      type === "announcement"
        ? `api/messages/announcements/${id}`
        : `api/feedback/${id}`;

    api.get(path)
      .then((res) => {
        if (type === "announcement") {
          const item = res.announcement;
          const content = item.content || "";
          const isHtml = hasHtmlContent(content);
          this.setData({
            item: {
              ...item,
              statusLabel: "官方消息",
              statusClass: "announcement",
              timeText: formatTime(item.publishedAt || item.createdAt),
              isHtmlContent: isHtml,
              contentHtml: isHtml ? prepareReplyHtml(content) : "",
              plainContent: isHtml ? "" : content,
            },
          });
          return;
        }

        const item = res.feedback;
        const adminReply = item.adminReply || "";
        const isHtmlReply = hasHtmlContent(adminReply);
        this.setData({
          item: {
            ...item,
            statusLabel: STATUS_LABELS[item.status] || item.status,
            statusClass: item.status || "pending",
            timeText: formatTime(item.createdAt),
            replyTimeText: formatTime(item.repliedAt),
            imageUrls: mapImageUrls(item.images),
            isHtmlReply,
            replyHtml: isHtmlReply ? prepareReplyHtml(adminReply) : "",
          },
        });
      })
      .catch(() => {
        wx.showToast({ title: "加载失败", icon: "none" });
      })
      .finally(() => wx.hideLoading());
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    const urls = (this.data.item && this.data.item.imageUrls) || [];
    if (!url || !urls.length) return;
    wx.previewImage({ current: url, urls });
  },
});
