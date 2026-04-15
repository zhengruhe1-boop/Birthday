const api = require('../../utils/api');
const { isLoggedIn, clearToken } = require('../../utils/auth');
const { calcAnniversaryYear, getZodiac } = require('../../utils/date');

// 将相对路径转为绝对 URL（微信小程序 image 不支持相对路径）
function toAbsUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const base = (getApp().globalData.apiBase || '').replace(/\/$/, '');
  return base + (url.startsWith('/') ? url : '/' + url);
}

// 将联系人列表中的头像 URL 转为绝对路径，并补充星座字段
function normalizeContacts(list) {
  return (list || []).map(c => ({
    ...c,
    avatarUrl: c.avatarUrl && !c.avatarUrl.startsWith('http') ? toAbsUrl(c.avatarUrl) : (c.avatarUrl || ''),
    zodiac: (!c.birthdayLunar && c.birthdayMonth && c.birthdayDay)
      ? getZodiac(c.birthdayMonth, c.birthdayDay) : '',
  }));
}

const PREF_EMAIL_NOTIFY = 'birthday_pref_email_notify';

Page({
  data: {
    userInfo: null,
    search: '',

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
    emailNotify: true,

    // 编辑昵称
    editNickname: '',
  },

  async onLoad() {
    // 等待 app.js 的无感知自动登录完成，避免重新进入时被误认为未登录
    const app = getApp();
    let loggedIn = false;
    if (app && app.globalData.sessionReady) {
      loggedIn = await app.globalData.sessionReady;
    } else {
      loggedIn = isLoggedIn();
    }

    if (!loggedIn) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    // 先从本地缓存预填用户信息，避免 API 响应慢时首页空白
    const cached = wx.getStorageSync('birthday_userinfo');
    if (cached && cached.nickname) {
      const cachedNorm = { ...cached, avatarUrl: toAbsUrl(cached.avatarUrl) };
      this.setData({ userInfo: cachedNorm, editNickname: cached.nickname });
    }

    const emailNotify = wx.getStorageSync(PREF_EMAIL_NOTIFY) !== 'false';
    this.setData({ emailNotify });
    this.loadAll();
  },

  onShow() {
    if (!isLoggedIn()) return;
    this.loadAll();
  },

  onPullDownRefresh() {
    this.loadAll(() => wx.stopPullDownRefresh());
  },

  async loadAll(done) {
    this.setData({ loadingUpcoming: true, loadingEvents: true });
    try {
      const [me, upcoming, events] = await Promise.all([
        api.get('api/auth/me').catch(() => null),
        api.get('api/contacts/upcoming').catch(() => ({ imminent: [], soon: [], monthly: [] })),
        api.get('api/events/upcoming').catch(() => ({ anniversaries: [], countdowns: [], others: [] })),
      ]);
      // 头像 URL 必须是绝对路径，微信小程序不支持相对路径
      const meNormalized = me ? { ...me, avatarUrl: toAbsUrl(me.avatarUrl) } : null;
      // 同步更新本地缓存，让下次启动时能立刻显示最新信息
      if (me) wx.setStorageSync('birthday_userinfo', me);
      const ann = (events.anniversaries || []).map(e => ({
        ...e,
        anniversaryYear: calcAnniversaryYear(e.eventDate),
      }));
      const upcomingNorm = upcoming ? {
        imminent: normalizeContacts(upcoming.imminent),
        soon: normalizeContacts(upcoming.soon),
        monthly: normalizeContacts(upcoming.monthly),
      } : { imminent: [], soon: [], monthly: [] };
      this.setData({
        userInfo: meNormalized,
        editNickname: me ? me.nickname : '',
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
    this.setData({ search: '', searchContacts: [], searchEvents: [], searching: false });
  },

  async doSearch(q) {
    this.setData({ searching: true });
    try {
      const contacts = await api.get('api/contacts?search=' + encodeURIComponent(q));
      const lower = q.toLowerCase();
      const allEvents = [...this.data.anniversaries, ...this.data.countdowns, ...this.data.others];
      const matchedEvents = allEvents.filter(e =>
        (e.name || '').toLowerCase().includes(lower) ||
        (e.person || '').toLowerCase().includes(lower)
      );
      this.setData({
        searchContacts: normalizeContacts(Array.isArray(contacts) ? contacts : []),
        searchEvents: matchedEvents,
        searching: false,
      });
    } catch {
      this.setData({ searching: false });
    }
  },

  // ── 头像：共用上传逻辑 ────────────────────────────────────────────────────────
  async _uploadAndSaveAvatar(tempUrl) {
    if (!tempUrl) return;
    // ① 立即把选中图片显示到 UI（不等服务器）
    const immediateInfo = { ...(this.data.userInfo || {}), avatarUrl: tempUrl };
    this.setData({ userInfo: immediateInfo });
    wx.setStorageSync('birthday_userinfo', immediateInfo);

    // ② 后台上传到服务器
    try {
      const uploadRes = await api.upload('api/upload', tempUrl, 'image');
      const rawUrl = uploadRes && uploadRes.url ? uploadRes.url : null;
      if (!rawUrl) {
        wx.showToast({ title: '头像已显示（上传失败，可重试）', icon: 'none' });
        return;
      }
      const serverUrl = toAbsUrl(rawUrl);
      // 保存到服务器；返回值的 avatarUrl 也强制转绝对路径
      await api.put('api/auth/me', { avatarUrl: serverUrl });
      const finalInfo = { ...(this.data.userInfo || {}), avatarUrl: serverUrl };
      this.setData({ userInfo: finalInfo });
      wx.setStorageSync('birthday_userinfo', finalInfo);
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch {
      wx.showToast({ title: '头像已显示（上传失败，可重试）', icon: 'none' });
    }
  },

  // ── 头像：使用微信头像（open-type="chooseAvatar"）────────────────────────────
  onChooseWxAvatar(e) {
    const tempUrl = e.detail.avatarUrl;
    if (!tempUrl) return;
    this._uploadAndSaveAvatar(tempUrl);
  },

  // ── 头像：从相册/拍照自定义上传 ─────────────────────────────────────────────
  async chooseCustomAvatar() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        });
      });
      const tempFile = res.tempFiles[0].tempFilePath;
      if (!tempFile) return;
      await this._uploadAndSaveAvatar(tempFile);
    } catch (err) {
      if (err && err.errMsg && err.errMsg.includes('cancel')) return;
      wx.showToast({ title: '选择图片失败', icon: 'none' });
    }
  },

  // ── 昵称：微信昵称选择器 bindnicknameverify（用户点"填入微信昵称"时触发）──────
  async onNicknameVerify(e) {
    // e.detail.nickname 是微信下发的真实昵称
    const nickname = (e.detail.nickname || '').trim();
    if (!nickname) return;
    this.setData({ editNickname: nickname });
    await this._saveNickname(nickname);
  },

  // ── 昵称：手动输入失焦后保存 ─────────────────────────────────────────────────
  async onNicknameBlur(e) {
    const nickname = (e.detail.value || '').trim();
    if (!nickname || nickname === (this.data.userInfo && this.data.userInfo.nickname)) return;
    this.setData({ editNickname: nickname });
    await this._saveNickname(nickname);
  },

  // ── 昵称：公共保存逻辑 ────────────────────────────────────────────────────────
  async _saveNickname(nickname) {
    try {
      const updated = await api.put('api/auth/me', { nickname });
      // 保留当前已有头像（服务端返回的 avatarUrl 可能是相对路径，不要直接覆盖）
      const currentAvatarUrl = (this.data.userInfo && this.data.userInfo.avatarUrl) || '';
      const serverAvatarUrl = toAbsUrl(updated.avatarUrl);
      const newInfo = {
        ...(this.data.userInfo || {}),
        ...updated,
        avatarUrl: serverAvatarUrl || currentAvatarUrl,
      };
      this.setData({ userInfo: newInfo });
      wx.setStorageSync('birthday_userinfo', newInfo);
      wx.showToast({ title: '昵称已更新', icon: 'success' });
    } catch {
      wx.showToast({ title: '昵称保存失败', icon: 'none' });
    }
  },

  // ── 导航 ─────────────────────────────────────────────────────────────────────
  goAddContact()    { wx.navigateTo({ url: '/pages/contact-form/contact-form?id=new' }); this.closeFab(); },
  goAddAnniversary(){ wx.navigateTo({ url: '/pages/event-form/event-form?type=anniversary' }); this.closeFab(); },
  goAddCountdown()  { wx.navigateTo({ url: '/pages/event-form/event-form?type=countdown' }); this.closeFab(); },
  goAddOther()      { wx.navigateTo({ url: '/pages/event-form/event-form?type=other' }); this.closeFab(); },

  goContact(e) { wx.navigateTo({ url: '/pages/contact-form/contact-form?id=' + e.currentTarget.dataset.id }); },
  goEvent(e)   { wx.navigateTo({ url: '/pages/event-form/event-form?id=' + e.currentTarget.dataset.id }); },

  // ── FAB ──────────────────────────────────────────────────────────────────────
  toggleFab() { this.setData({ showFab: !this.data.showFab }); },
  closeFab()  { this.setData({ showFab: false }); },

  // ── 设置 ─────────────────────────────────────────────────────────────────────
  openSettings() { this.setData({ showSettings: true, editNickname: this.data.userInfo ? this.data.userInfo.nickname : '' }); },
  closeSettings(){ this.setData({ showSettings: false }); },
  goSubscribePage() { this.closeSettings(); wx.navigateTo({ url: '/pages/subscribe/subscribe' }); },

  toggleEmailNotify(e) {
    const v = e.detail.value;
    this.setData({ emailNotify: v });
    wx.setStorageSync(PREF_EMAIL_NOTIFY, v ? 'true' : 'false');
  },

  // ── 退出 ─────────────────────────────────────────────────────────────────────
  handleLogout() {
    wx.showModal({
      title: '退出登录', content: '确定要退出登录吗？',
      confirmText: '退出', confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          clearToken();
          // 重置 sessionReady，防止登录页因已缓存的 true 值立即跳回首页
          const app = getApp();
          if (app) app.globalData.sessionReady = Promise.resolve(false);
          this.closeSettings();
          wx.reLaunch({ url: '/pages/login/login' });
        }
      },
    });
  },
});
