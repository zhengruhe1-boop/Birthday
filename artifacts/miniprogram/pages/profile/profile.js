const api = require("../../utils/api");
const { isLoggedIn, clearToken } = require("../../utils/auth");

const PREF_EMAIL_NOTIFY = "birthday_pref_email_notify";
const FORTUNE_SIGN_KEY = "fortune_sign";
const INVALID_NICKNAMES = ["获取微信昵称", "微信昵称", "用户昵称", "微信用户"];

function cleanNickname(nickname) {
  const s = (nickname || "").trim();
  return INVALID_NICKNAMES.includes(s) ? "" : s;
}

function toAbsUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const base = (getApp().globalData.apiBase || "").replace(/\/$/, "");
  return base + (url.startsWith("/") ? url : "/" + url);
}

function toDisplayAvatar(url) {
  if (!url || !url.startsWith("http")) return "";
  if (url.includes("/0/0")) return "";
  return url;
}

Page({
  data: {
    loggedIn: false,
    userInfo: null,
    displayNickname: "未登录",
    displayAvatarUrl: "",
    emailNotify: true,
    showWxProfileModal: false,
    wxProfileTemp: { avatarUrl: "", nickname: "" },
    avatarUploading: false,
    fortuneSign: "",
    oaSubscribed: false,
  },

  onLoad() {
    const emailNotify = wx.getStorageSync(PREF_EMAIL_NOTIFY) !== "false";
    this.setData({ emailNotify });
  },

  onShow() {
    const fortuneSign = wx.getStorageSync(FORTUNE_SIGN_KEY) || "";
    this.setData({ fortuneSign });
    const loggedIn = isLoggedIn();
    this.setData({ loggedIn });
    if (!loggedIn) {
      this.setData({ displayNickname: "未登录", displayAvatarUrl: "", oaSubscribed: false });
      return;
    }
    // 从缓存读取用户信息
    const cached = wx.getStorageSync("birthday_userinfo");
    if (cached) {
      const avatarUrl = toDisplayAvatar(toAbsUrl(cached.avatarUrl));
      const nickname = cleanNickname(cached.nickname);
      this.setData({
        userInfo: cached,
        displayAvatarUrl: avatarUrl,
        displayNickname: nickname || "用户",
      });
    }
    // 加载公众号订阅状态
    this._loadOaStatus();
  },

  _loadOaStatus() {
    api.get("api/auth/wechat/subscribe-status")
      .then((res) => {
        this.setData({ oaSubscribed: !!(res && res.subscribed) });
      })
      .catch(() => {
        this.setData({ oaSubscribed: false });
      });
  },

  onAvatarError() {
    this.setData({ displayAvatarUrl: "" });
  },

  toggleEmailNotify(e) {
    const v = e.detail.value;
    this.setData({ emailNotify: v });
    wx.setStorageSync(PREF_EMAIL_NOTIFY, v ? "true" : "false");
  },

  goSubscribe() {
    wx.navigateTo({ url: "/pages/subscribe/subscribe" });
  },

  goFollowOA() {
    wx.navigateTo({ url: "/pages/follow-oa/follow-oa" });
  },

  goFortune() {
    wx.navigateTo({ url: "/pages/fortune/fortune" });
  },

  goHiddenEvents() {
    wx.navigateTo({ url: "/pages/hidden-events/hidden-events" });
  },

  goUserAgreement() {
    wx.navigateTo({ url: "/pages/legal/legal?type=agreement" });
  },

  goPrivacyPolicy() {
    wx.navigateTo({ url: "/pages/legal/legal?type=privacy" });
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" });
  },

  shareApp() {
    wx.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage"] });
  },

  handleLogout() {
    wx.showModal({
      title: "退出登录",
      content: "确定要退出登录吗？",
      confirmText: "退出",
      confirmColor: "#ef4444",
      success: (res) => {
        if (res.confirm) {
          api.post("api/auth/logout", {}).catch(() => {});
          clearToken();
          const app = getApp();
          if (app) app.globalData.sessionReady = Promise.resolve(false);
          this.setData({ loggedIn: false, displayNickname: "未登录", displayAvatarUrl: "", userInfo: null });
          wx.reLaunch({ url: "/pages/login/login" });
        }
      },
    });
  },

  // ── 微信资料授权弹窗 ──────────────────────────────────────────────────────────
  openWxProfileModal() {
    if (!this.data.loggedIn) return;
    this.setData({
      showWxProfileModal: true,
      wxProfileTemp: {
        avatarUrl: this.data.displayAvatarUrl || "",
        nickname: this.data.displayNickname !== "用户" ? this.data.displayNickname : "",
      },
    });
  },

  skipWxProfile() {
    this.setData({ showWxProfileModal: false });
  },

  onWxProfileAvatarChosen(e) {
    const tempPath = e.detail && e.detail.avatarUrl;
    if (!tempPath) return;
    this._wxAvatarIsNew = true;
    this.setData({ "wxProfileTemp.avatarUrl": tempPath });
  },

  onWxProfileNicknameInput(e) {
    this.setData({ "wxProfileTemp.nickname": e.detail.value || "" });
  },

  async saveWxProfile() {
    if (!this.data.loggedIn) return;
    const { avatarUrl: avatarPath, nickname } = this.data.wxProfileTemp;
    const cleanedNickname = cleanNickname(nickname || "");
    const avatarChanged = !!this._wxAvatarIsNew;

    if (!avatarPath && !cleanedNickname) {
      this.setData({ showWxProfileModal: false });
      return;
    }

    this.setData({ avatarUploading: true });
    try {
      let serverAvatarUrl = "";

      if (avatarPath) {
        if (!avatarChanged) {
          serverAvatarUrl = avatarPath.startsWith("http") ? avatarPath : "";
        } else {
          let uploadPath = avatarPath;
          try {
            const compressed = await new Promise((resolve, reject) => {
              wx.compressImage({ src: avatarPath, quality: 80, success: resolve, fail: reject });
            });
            if (compressed && compressed.tempFilePath) uploadPath = compressed.tempFilePath;
          } catch { /* ignore */ }
          const upRes = await api.upload("api/upload", uploadPath, "image");
          if (upRes && upRes.url) serverAvatarUrl = toAbsUrl(upRes.url);
        }
      }

      const payload = {};
      if (serverAvatarUrl) payload.avatarUrl = serverAvatarUrl;
      if (cleanedNickname) payload.nickname = cleanedNickname;
      if (Object.keys(payload).length > 0) {
        await api.put("api/auth/me", payload);
      }

      const newInfo = {
        ...(this.data.userInfo || {}),
        ...(serverAvatarUrl ? { avatarUrl: serverAvatarUrl } : {}),
        ...(cleanedNickname ? { nickname: cleanedNickname } : {}),
      };
      const displayAvatar = toDisplayAvatar(serverAvatarUrl || this.data.displayAvatarUrl);
      this._wxAvatarIsNew = false;
      this.setData({
        userInfo: newInfo,
        displayAvatarUrl: displayAvatar,
        displayNickname: cleanedNickname || this.data.displayNickname,
        avatarUploading: false,
        showWxProfileModal: false,
        wxProfileTemp: { avatarUrl: "", nickname: "" },
      });
      wx.setStorageSync("birthday_userinfo", newInfo);
      wx.showToast({ title: "资料已保存", icon: "success" });
    } catch (err) {
      this.setData({ avatarUploading: false });
      const msg = (err && err.message) ? err.message : "保存失败，请重试";
      wx.showToast({ title: msg.slice(0, 20), icon: "none" });
    }
  },

  noop() {},

  onShareAppMessage() {
    return {
      title: "生日通.让您不再错过每个重要日子",
      path: "/pages/home/home",
      imageUrl: "/images/logo.jpg",
    };
  },
});
