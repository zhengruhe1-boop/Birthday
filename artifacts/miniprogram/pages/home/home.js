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
    nicknameChanged: false,   // 是否有未保存的昵称修改
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
      const serverAvatar = toAbsUrl(me && me.avatarUrl);
      // 优先用本次上传成功后记录的永久 URL，防止 loadAll 旧快照覆盖刚上传的头像
      const avatarForCache = this._lastSavedAvatarUrl || serverAvatar;
      this._lastSavedAvatarUrl = null;  // 使用一次后清除
      const meNormalized = me ? { ...me, avatarUrl: avatarForCache } : null;
      // 同步更新本地缓存——始终用绝对路径写入，确保下次启动能正确加载
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

    // 记住上传前的头像，失败时可恢复
    const prevAvatarUrl = (this.data.userInfo && this.data.userInfo.avatarUrl) || '';

    // ① 仅更新 UI 显示临时图片，不写入缓存（临时路径重启后失效）
    this.setData({ userInfo: { ...(this.data.userInfo || {}), avatarUrl: tempUrl } });
    this._avatarUploading = true;  // 标记上传中，阻止 loadAll 覆盖缓存

    // ② 上传到服务器
    try {
      const uploadRes = await api.upload('api/upload', tempUrl, 'image');
      const rawUrl = uploadRes && uploadRes.url ? uploadRes.url : null;
      if (!rawUrl) throw new Error('服务器未返回图片地址');

      const serverUrl = toAbsUrl(rawUrl);
      await api.put('api/auth/me', { avatarUrl: serverUrl });

      // 上传成功：用服务器永久地址更新 UI 和缓存
      const base = (this.data.userInfo || {});
      const finalInfo = { ...base, avatarUrl: serverUrl };
      this.setData({ userInfo: finalInfo });
      wx.setStorageSync('birthday_userinfo', finalInfo);
      this._lastSavedAvatarUrl = serverUrl;  // 记录最新永久 URL
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch (err) {
      // 上传失败：恢复原头像（避免缓存临时路径）
      this.setData({ userInfo: { ...(this.data.userInfo || {}), avatarUrl: prevAvatarUrl } });
      wx.showToast({ title: '头像上传失败，请重试', icon: 'none' });
    } finally {
      this._avatarUploading = false;
    }
  },

  // ── 头像：open-type="chooseAvatar" 回调 ─────────────────────────────────────
  onChooseAvatar(e) {
    const tempUrl = e.detail.avatarUrl;
    if (!tempUrl) return;
    this._uploadAndSaveAvatar(tempUrl);
  },

  // ── 昵称：bindinput —— 用户手动输入时更新本地 data，标记有未保存改动 ─────────
  onNicknameInput(e) {
    const nickname = e.detail.value;
    const original = (this.data.userInfo && this.data.userInfo.nickname) || '';
    this.setData({
      editNickname: nickname,
      nicknameChanged: nickname.trim() !== original.trim(),
    });
  },

  // ── 昵称：bindnicknameverify —— 微信授权昵称，直接保存 ───────────────────────
  async onNicknameVerify(e) {
    const nickname = (e.detail.nickname || '').trim();
    if (!nickname) {
      wx.showToast({ title: '未获取到昵称，请重试', icon: 'none' });
      return;
    }
    this.setData({ editNickname: nickname, nicknameChanged: false });
    await this._saveNickname(nickname);
  },

  // ── 昵称：bindblur —— 失去焦点时若有改动则自动保存（手动输入场景）────────────
  async onNicknameBlur() {
    if (!this.data.nicknameChanged) return;
    const nickname = (this.data.editNickname || '').trim();
    if (!nickname) return;
    this.setData({ nicknameChanged: false });
    await this._saveNickname(nickname);
  },

  // ── 昵称：按钮手动保存（nicknameChanged=true 时显示）────────────────────────
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
  openSettings() {
    this.setData({
      showSettings: true,
      editNickname: this.data.userInfo ? this.data.userInfo.nickname : '',
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
