const api = require("../../utils/api");
const { getUser, clearSession, isLoggedIn } = require("../../utils/auth");
const { track } = require("../../utils/track");

Page({
  data: {
    loggedIn: false,
    user: null,
    displayName: "未登录",
    avatarText: "客",
    unreadCount: 0,
  },

  onShow() {
    if (!isLoggedIn()) {
      this.setData({
        loggedIn: false,
        user: null,
        displayName: "未登录",
        avatarText: "客",
        unreadCount: 0,
      });
      track("page_view", { page: "profile" });
      return;
    }

    const user = getUser();
    const nickname = (user && user.nickname) || "微信用户";
    this.setData({
      loggedIn: true,
      user,
      displayName: nickname,
      avatarText: nickname.slice(0, 1),
    });
    this._loadUnreadCount();
    track("page_view", { page: "profile" });
  },

  _loadUnreadCount() {
    api.get("api/messages/unread-count")
      .then((res) => {
        this.setData({ unreadCount: (res && res.count) || 0 });
      })
      .catch(() => {
        this.setData({ unreadCount: 0 });
      });
  },

  onUserCardTap() {
    if (!this.data.loggedIn) {
      this.goLogin();
    }
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/login?from=profile" });
  },

  goFeedback() {
    if (!this.data.loggedIn) {
      this.goLogin();
      return;
    }
    wx.navigateTo({ url: "/pages/feedback/feedback" });
  },

  goMessages() {
    if (!this.data.loggedIn) {
      this.goLogin();
      return;
    }
    wx.navigateTo({ url: "/pages/messages/messages" });
  },

  goLegal(e) {
    const type = e.currentTarget.dataset.type || "terms";
    wx.navigateTo({ url: `/pages/legal/legal?type=${type}` });
  },

  logout() {
    wx.showModal({
      title: "退出登录",
      content: "确定要退出登录吗？",
      confirmText: "退出",
      confirmColor: "#e67e22",
      success: (res) => {
        if (!res.confirm) return;
        clearSession();
        this.setData({
          loggedIn: false,
          user: null,
          displayName: "未登录",
          avatarText: "客",
          unreadCount: 0,
        });
        wx.showToast({ title: "已退出登录", icon: "success" });
      },
    });
  },
});
