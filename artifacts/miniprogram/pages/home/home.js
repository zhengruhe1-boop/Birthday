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

// 构建显示用的问候语
function buildDisplayNickname(nickname) {
  const name = (nickname || '').trim();
  return name ? '您好！' + name : '您好！欢迎使用生日通';
}

const PREF_EMAIL_NOTIFY = 'birthday_pref_email_notify';
const DEFAULT_AVATAR = '/images/logo.jpg';

Page({
  data: {
    userInfo: null,
    displayNickname: '您好！欢迎使用生日通',
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
    nicknameChanged: false,
    avatarUploading: false,
  },

  async onLoad() {
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

    // 先从本地缓存预填用户信息
    const cached = wx.getStorageSync('birthday_userinfo');
    if (cached) {
      const cachedNorm = { ...cached, avatarUrl: toAbsUrl(cached.avatarUrl) };
      this.setData({
        userInfo: cachedNorm,
        editNickname: cached.nickname || '',
        displayNickname: buildDisplayNickname(cached.nickname),
      });
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
      const serverAvatar = toAbsUrl(me && me.avatarUrl);
      // 优先用本次上传成功后记录的永久 URL，防止 loadAll 旧快照覆盖刚上传的头像
      const avatarForCache = this._lastSavedAvatarUrl || serverAvatar;
      this._lastSavedAvatarUrl = null;
      const meNormalized = me ? { ...me, avatarUrl: avatarForCache } : null;
      if (meNormalized) wx.setStorageSync('birthday_userinfo', meNormalized);
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
        editNickname: me ? (me.nickname || '') : '',
        displayNickname: buildDisplayNickname(me ? me.nickname : ''),
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

  // ── 头像：点击触发相册选图 ────────────────────────────────────────────────────
  async chooseAvatar() {
    const prevAvatarUrl = (this.data.userInfo && this.data.userInfo.avatarUrl
      && this.data.userInfo.avatarUrl.startsWith('http'))
      ? this.data.userInfo.avatarUrl : null;

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
      const tempUrl = res.tempFiles[0].tempFilePath;
      await this._uploadAndSaveAvatar(tempUrl, prevAvatarUrl);
    } catch (err) {
      if (err && err.errMsg && err.errMsg.includes('cancel')) return;
      wx.showToast({ title: '选择图片失败', icon: 'none' });
    }
  },

  // ── 头像：通用上传保存逻辑 ────────────────────────────────────────────────────
  async _uploadAndSaveAvatar(tempUrl, prevAvatarUrl) {
    if (!tempUrl) return;
    this.setData({
      userInfo: { ...(this.data.userInfo || {}), avatarUrl: tempUrl },
      avatarUploading: true,
    });
    this._avatarUploading = true;

    try {
      const uploadRes = await api.upload('api/upload', tempUrl, 'image');
      const rawUrl = uploadRes && uploadRes.url ? uploadRes.url : null;
      if (!rawUrl) throw new Error('服务器未返回图片地址');

      const serverUrl = toAbsUrl(rawUrl);
      await api.put('api/auth/me', { avatarUrl: serverUrl });

      const finalInfo = { ...(this.data.userInfo || {}), avatarUrl: serverUrl };
      this.setData({ userInfo: finalInfo, avatarUploading: false });
      wx.setStorageSync('birthday_userinfo', finalInfo);
      this._lastSavedAvatarUrl = serverUrl;
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch {
      this.setData({
        userInfo: { ...(this.data.userInfo || {}), avatarUrl: prevAvatarUrl || '' },
        avatarUploading: false,
      });
      wx.showToast({ title: '头像上传失败，请重试', icon: 'none' });
    } finally {
      this._avatarUploading = false;
    }
  },

  // ── 昵称：输入时标记有未保存改动 ─────────────────────────────────────────────
  onNicknameInput(e) {
    const nickname = e.detail.value;
    const original = (this.data.userInfo && this.data.userInfo.nickname) || '';
    this.setData({
      editNickname: nickname,
      nicknameChanged: nickname.trim() !== original.trim(),
    });
  },

  // ── 昵称：失去焦点自动保存 ────────────────────────────────────────────────────
  async onNicknameBlur() {
    if (!this.data.nicknameChanged) return;
    const nickname = (this.data.editNickname || '').trim();
    if (!nickname) return;
    this.setData({ nicknameChanged: false });
    await this._saveNickname(nickname);
  },

  // ── 昵称：手动点击保存按钮 ───────────────────────────────────────────────────
  async saveNickname() {
    const nickname = (this.data.editNickname || '').trim();
    if (!nickname) return;
    this.setData({ nicknameChanged: false });
    await this._saveNickname(nickname);
  },

  // ── 昵称：公共保存逻辑 ────────────────────────────────────────────────────────
  async _saveNickname(nickname) {
    try {
      const updated = await api.put('api/auth/me', { nickname });
      const currentAvatarUrl = (this.data.userInfo && this.data.userInfo.avatarUrl) || '';
      const serverAvatarUrl = toAbsUrl(updated.avatarUrl);
      const newInfo = {
        ...(this.data.userInfo || {}),
        ...updated,
        avatarUrl: serverAvatarUrl || currentAvatarUrl,
      };
      this.setData({
        userInfo: newInfo,
        displayNickname: buildDisplayNickname(nickname),
      });
      wx.setStorageSync('birthday_userinfo', newInfo);
      wx.showToast({ title: '昵称已保存', icon: 'success' });
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
  openSettings() {
    this.setData({
      showSettings: true,
      editNickname: (this.data.userInfo && this.data.userInfo.nickname) || '',
      nicknameChanged: false,
    });
  },
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
          const app = getApp();
          if (app) app.globalData.sessionReady = Promise.resolve(false);
          this.closeSettings();
          wx.reLaunch({ url: '/pages/login/login' });
        }
      },
    });
  },
});
