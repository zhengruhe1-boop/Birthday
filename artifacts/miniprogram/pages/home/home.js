const api = require("../../utils/api");
const { isLoggedIn, clearToken } = require("../../utils/auth");
const { calcAnniversaryYear, getZodiac } = require("../../utils/date");

// 将相对路径转为绝对 URL（微信小程序 image 不支持相对路径）
function toAbsUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const base = (getApp().globalData.apiBase || "").replace(/\/$/, "");
  return base + (url.startsWith("/") ? url : "/" + url);
}

// 十二生肖（以 1900 鼠年为基准）
const SHENGXIAO = [
  "鼠",
  "牛",
  "虎",
  "兔",
  "龙",
  "蛇",
  "马",
  "羊",
  "猴",
  "鸡",
  "狗",
  "猪",
];
function getShengxiao(year) {
  if (!year || year < 1) return "";
  return SHENGXIAO[(((year - 1900) % 12) + 12) % 12];
}

// 将联系人列表中的头像 URL 转为绝对路径，并补全展示字段
// 星座直接使用服务端返回的 zodiac 字段（服务端已处理农历→公历转换）
function normalizeContacts(list) {
  return (list || []).map((c) => ({
    ...c,
    avatarUrl:
      c.avatarUrl && !c.avatarUrl.startsWith("http")
        ? toAbsUrl(c.avatarUrl)
        : c.avatarUrl || "",
    zodiac: c.zodiac || "",
    gender: c.gender || "",
    shengxiao: c.birthYear ? getShengxiao(c.birthYear) : "",
  }));
}

// 清理微信系统占位文字（含脱敏默认昵称），视为未设置昵称
const INVALID_NICKNAMES = ["获取微信昵称", "微信昵称", "用户昵称", "微信用户"];
function cleanNickname(nickname) {
  const s = (nickname || "").trim();
  return INVALID_NICKNAMES.includes(s) ? "" : s;
}

// 构建显示用的问候语
function buildDisplayNickname(nickname) {
  const name = cleanNickname(nickname);
  return name ? "您好！" + name : "您好！欢迎使用生日通";
}

const PREF_EMAIL_NOTIFY = "birthday_pref_email_notify";
const DEFAULT_AVATAR = "/images/logo.jpg";

// 只有以 http 开头且非微信默认灰色头像（/0/0）的才展示，否则返回空（显示 logo）
function toDisplayAvatar(url) {
  if (!url || !url.startsWith("http")) return "";
  if (url.includes("/0/0")) return ""; // 微信脱敏默认灰色头像
  return url;
}

Page({
  data: {
    loggedIn: false,
    userInfo: null,
    displayNickname: "您好！欢迎使用生日通",
    displayAvatarUrl: "", // 空串 → wxml 里显示 logo.jpg；http URL → 显示上传头像
    search: "",

    upcoming: { imminent: [], soon: [], monthly: [] },
    loadingUpcoming: false,

    anniversaries: [],
    countdowns: [],
    others: [],
    loadingEvents: false,

    searchContacts: [],
    searchEvents: [],
    searching: false,

    showFab: false,
    showSettings: false,
    showWxProfileModal: false,
    emailNotify: true,

    editNickname: "",
    avatarUploading: false,

    // 微信授权弹窗临时数据
    wxProfileTemp: { avatarUrl: "", nickname: "" },
  },

  async onLoad() {
    const app = getApp();
    let loggedIn = false;
    if (app && app.globalData.sessionReady) {
      loggedIn = await app.globalData.sessionReady;
    } else {
      loggedIn = isLoggedIn();
    }

    this.setData({ loggedIn });

    if (!loggedIn) return; // 游客模式：不加载数据，等用户手动登录

    // 先从本地缓存预填用户信息
    const cached = wx.getStorageSync("birthday_userinfo");
    if (cached) {
      const cachedAvatarUrl = toAbsUrl(cached.avatarUrl);
      const cachedNorm = { ...cached, avatarUrl: cachedAvatarUrl };
      this.setData({
        userInfo: cachedNorm,
        displayAvatarUrl: toDisplayAvatar(cachedAvatarUrl),
        editNickname: cleanNickname(cached.nickname),
        displayNickname: buildDisplayNickname(cached.nickname),
      });
    }

    const emailNotify = wx.getStorageSync(PREF_EMAIL_NOTIFY) !== "false";
    this.setData({ emailNotify });
    this.loadAll();
  },

  onShow() {
    const loggedIn = isLoggedIn();
    this.setData({ loggedIn });
    if (!loggedIn) return;
    this.loadAll();
  },

  onPullDownRefresh() {
    this.loadAll(() => wx.stopPullDownRefresh());
  },

  async loadAll(done) {
    this.setData({ loadingUpcoming: true, loadingEvents: true });
    try {
      const [me, upcoming, events] = await Promise.all([
        api.get("api/auth/me").catch(() => null),
        api
          .get("api/contacts/upcoming")
          .catch(() => ({ imminent: [], soon: [], monthly: [] })),
        api
          .get("api/events/upcoming")
          .catch(() => ({ anniversaries: [], countdowns: [], others: [] })),
      ]);
      const serverAvatar = toAbsUrl(me && me.avatarUrl);
      // 优先用本次上传成功后记录的永久 URL，防止 loadAll 旧快照覆盖刚上传的头像
      const avatarForCache = this._lastSavedAvatarUrl || serverAvatar;
      this._lastSavedAvatarUrl = null;
      const meNormalized = me ? { ...me, avatarUrl: avatarForCache } : null;
      if (meNormalized) wx.setStorageSync("birthday_userinfo", meNormalized);
      const ann = (events.anniversaries || []).map((e) => ({
        ...e,
        anniversaryYear: calcAnniversaryYear(e.eventDate),
      }));
      const upcomingNorm = upcoming
        ? {
            imminent: normalizeContacts(upcoming.imminent),
            soon: normalizeContacts(upcoming.soon),
            monthly: normalizeContacts(upcoming.monthly),
          }
        : { imminent: [], soon: [], monthly: [] };
      this.setData({
        userInfo: meNormalized,
        displayAvatarUrl: toDisplayAvatar(
          meNormalized ? meNormalized.avatarUrl : "",
        ),
        editNickname: cleanNickname(me ? me.nickname : ""),
        displayNickname: buildDisplayNickname(me ? me.nickname : ""),
        upcoming: upcomingNorm,
        anniversaries: ann,
        countdowns: events.countdowns || [],
        others: events.others || [],
        loadingUpcoming: false,
        loadingEvents: false,
      });
    } catch {
      this.setData({ loadingUpcoming: false, loadingEvents: false });
    }
    if (done) done();
    this._checkAutoShowWxProfileModal();
  },

  // ── 搜索 ─────────────────────────────────────────────────────────────────────
  onSearchInput(e) {
    const q = e.detail.value.trim();
    this.setData({ search: q });
    if (!q) {
      this.setData({ searchContacts: [], searchEvents: [], searching: false });
      return;
    }
    this.doSearch(q);
  },

  onSearchClear() {
    this.setData({
      search: "",
      searchContacts: [],
      searchEvents: [],
      searching: false,
    });
  },

  async doSearch(q) {
    this.setData({ searching: true });
    try {
      const contacts = await api.get(
        "api/contacts?search=" + encodeURIComponent(q),
      );
      const lower = q.toLowerCase();
      const allEvents = [
        ...this.data.anniversaries,
        ...this.data.countdowns,
        ...this.data.others,
      ];
      const matchedEvents = allEvents.filter(
        (e) =>
          (e.name || "").toLowerCase().includes(lower) ||
          (e.person || "").toLowerCase().includes(lower),
      );
      this.setData({
        searchContacts: normalizeContacts(
          Array.isArray(contacts) ? contacts : [],
        ),
        searchEvents: matchedEvents,
        searching: false,
      });
    } catch {
      this.setData({ searching: false });
    }
  },

  // ── 头像图片加载失败时（URL 过期/失效）回退到 logo ──────────────────────────
  onAvatarImgError() {
    this.setData({ displayAvatarUrl: "" });
  },

  // ── 微信资料授权弹窗：首次自动弹出检查 ──────────────────────────────────────
  _checkAutoShowWxProfileModal() {
    if (!this.data.loggedIn) return;
    if (wx.getStorageSync("birthday_wx_profile_asked")) return;
    wx.setStorageSync("birthday_wx_profile_asked", true);
    this.setData({
      showWxProfileModal: true,
      wxProfileTemp: {
        avatarUrl: this.data.displayAvatarUrl || "",
        nickname: this.data.editNickname || "",
      },
    });
  },

  // ── 微信资料授权弹窗：主动打开（从设置页按钮触发） ─────────────────────────
  openWxProfileModal() {
    this.setData({
      showWxProfileModal: true,
      showSettings: false,
      wxProfileTemp: {
        avatarUrl: this.data.displayAvatarUrl || "",
        nickname: this.data.editNickname || "",
      },
    });
  },

  // ── open-type="chooseAvatar" 回调：用户选择头像后立即预览 ──────────────────
  // e.detail.avatarUrl 是微信本地临时路径（非 http URL），可直接用于预览
  onWxProfileAvatarChosen(e) {
    const tempPath = e.detail && e.detail.avatarUrl;
    if (!tempPath) return;
    this.setData({ "wxProfileTemp.avatarUrl": tempPath });
  },

  // ── type="nickname" 回调：用户从微信昵称建议键盘确认后写入 ────────────────────
  onWxProfileNicknameInput(e) {
    this.setData({ "wxProfileTemp.nickname": e.detail.value || "" });
  },

  // ── 点"完成"：压缩头像 → 上传服务器 → 保存昵称 → 刷新展示 ─────────────────
  async saveWxProfile() {
    if (!this.data.loggedIn) { this._requireLogin("保存资料"); return; }

    const { avatarUrl: tempAvatarPath, nickname } = this.data.wxProfileTemp;
    const cleanedNickname = cleanNickname(nickname || "");

    // 头像和昵称都没选，直接关闭
    if (!tempAvatarPath && !cleanedNickname) {
      this.setData({ showWxProfileModal: false });
      return;
    }

    this.setData({ avatarUploading: true });
    try {
      let serverAvatarUrl = "";

      if (tempAvatarPath) {
        // 1. wx.compressImage 将头像压缩到 80% 质量，避免超过服务器 12MB 限制
        let uploadPath = tempAvatarPath;
        try {
          const compressed = await new Promise((resolve, reject) => {
            wx.compressImage({
              src: tempAvatarPath,
              quality: 80,
              success: resolve,
              fail: reject,
            });
          });
          if (compressed && compressed.tempFilePath) {
            uploadPath = compressed.tempFilePath;
          }
        } catch {
          // 压缩失败则直接用原始临时路径上传
        }

        // 2. 上传到服务器，得到永久可访问的 URL
        const upRes = await api.upload("api/upload", uploadPath, "image");
        if (upRes && upRes.url) {
          serverAvatarUrl = toAbsUrl(upRes.url);
        }
      }

      // 3. 写入服务器（只写有效数据）
      const payload = {};
      if (serverAvatarUrl) payload.avatarUrl = serverAvatarUrl;
      if (cleanedNickname) payload.nickname = cleanedNickname;
      if (Object.keys(payload).length > 0) {
        await api.put("api/auth/me", payload);
      }

      // 4. 立即更新页面头部展示（不等待 loadAll 重新请求）
      const newInfo = {
        ...(this.data.userInfo || {}),
        ...(serverAvatarUrl ? { avatarUrl: serverAvatarUrl } : {}),
        ...(cleanedNickname ? { nickname: cleanedNickname } : {}),
      };
      const finalAvatarUrl = serverAvatarUrl || (
        toDisplayAvatar(this.data.displayAvatarUrl) ? this.data.displayAvatarUrl : ""
      );
      this.setData({
        userInfo: newInfo,
        displayAvatarUrl: toDisplayAvatar(finalAvatarUrl),
        editNickname: cleanedNickname,
        displayNickname: buildDisplayNickname(cleanedNickname),
        avatarUploading: false,
        showWxProfileModal: false,
        wxProfileTemp: { avatarUrl: "", nickname: "" },
      });
      wx.setStorageSync("birthday_userinfo", newInfo);
      this._lastSavedAvatarUrl = serverAvatarUrl || null;
      wx.showToast({ title: "资料已保存", icon: "success" });
    } catch (err) {
      this.setData({ avatarUploading: false });
      const msg = (err && err.message) ? err.message : "保存失败，请重试";
      wx.showToast({ title: msg.slice(0, 20), icon: "none" });
    }
  },

  // ── 跳过授权（"取消"按钮 / 点蒙层） ──────────────────────────────────────────
  skipWxProfile() {
    this.setData({ showWxProfileModal: false });
  },

  // ── 登录引导（未登录时统一弹窗提示）────────────────────────────────────────────
  _requireLogin(hint) {
    wx.showModal({
      title: "需要登录",
      content: hint + "需要先登录，是否前往登录？",
      confirmText: "去登录",
      cancelText: "取消",
      success: (res) => {
        if (res.confirm) wx.navigateTo({ url: "/pages/login/login" });
      },
    });
  },

  // ── 导航 ─────────────────────────────────────────────────────────────────────
  goAddContact() {
    if (!this.data.loggedIn) {
      this._requireLogin("添加生日");
      return;
    }
    wx.navigateTo({ url: "/pages/contact-form/contact-form?id=new" });
    this.closeFab();
  },
  goAddAnniversary() {
    if (!this.data.loggedIn) {
      this._requireLogin("添加纪念日");
      return;
    }
    wx.navigateTo({ url: "/pages/event-form/event-form?type=anniversary" });
    this.closeFab();
  },
  goAddCountdown() {
    if (!this.data.loggedIn) {
      this._requireLogin("添加倒数日");
      return;
    }
    wx.navigateTo({ url: "/pages/event-form/event-form?type=countdown" });
    this.closeFab();
  },
  goAddOther() {
    if (!this.data.loggedIn) {
      this._requireLogin("添加其它提醒");
      return;
    }
    wx.navigateTo({ url: "/pages/event-form/event-form?type=other" });
    this.closeFab();
  },

  goContact(e) {
    wx.navigateTo({
      url: "/pages/contact-form/contact-form?id=" + e.currentTarget.dataset.id,
    });
  },
  goEvent(e) {
    wx.navigateTo({
      url: "/pages/event-form/event-form?id=" + e.currentTarget.dataset.id,
    });
  },

  // ── 前往登录页 ───────────────────────────────────────────────────────────────
  goLogin() {
    wx.navigateTo({ url: "/pages/login/login" });
  },

  // ── FAB ──────────────────────────────────────────────────────────────────────
  toggleFab() {
    this.setData({ showFab: !this.data.showFab });
  },
  closeFab() {
    this.setData({ showFab: false });
  },

  // ── 设置 ─────────────────────────────────────────────────────────────────────
  openSettings() {
    this.setData({ showSettings: true });
  },
  closeSettings() {
    this.setData({ showSettings: false });
  },
  goSubscribePage() {
    this.closeSettings();
    wx.navigateTo({ url: "/pages/subscribe/subscribe" });
  },

  toggleEmailNotify(e) {
    const v = e.detail.value;
    this.setData({ emailNotify: v });
    wx.setStorageSync(PREF_EMAIL_NOTIFY, v ? "true" : "false");
  },

  // ── 事件冒泡拦截（防止弹窗内点击穿透到遮罩） ──────────────────────────────────
  noop() {},

  // ── 退出 ─────────────────────────────────────────────────────────────────────
  handleLogout() {
    wx.showModal({
      title: "退出登录",
      content: "确定要退出登录吗？",
      confirmText: "退出",
      confirmColor: "#ef4444",
      success: (res) => {
        if (res.confirm) {
          // 先调服务端使 token 失效，再清本地
          api.post("api/auth/logout", {}).catch(() => {});
          clearToken();
          const app = getApp();
          if (app) app.globalData.sessionReady = Promise.resolve(false);
          this.closeSettings();
          wx.reLaunch({ url: "/pages/login/login" });
        }
      },
    });
  },

  // ── 分享给好友 ─────────────────────────────────────────────────────────────
  onShareAppMessage() {
    return {
      title: "生日通.让您不再错过每个重要日子",
      path: "/pages/home/home",
      imageUrl: "/images/logo.jpg",
    };
  },

  // ── 分享到朋友圈 ───────────────────────────────────────────────────────────
  onShareTimeline() {
    return {
      title: "生日通.让您不再错过每个重要日子",
      imageUrl: "/images/logo.jpg",
    };
  },
});
