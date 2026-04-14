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
    savingProfile: false,
  },

  onLoad() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
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

  // ── 头像：使用微信 chooseAvatar ──────────────────────────────────────────────
  async onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;   // 微信临时路径
    if (!avatarUrl) return;
    wx.showLoading({ title: '更新头像...' });
    try {
      // 1. 先上传到服务器
      const uploadRes = await api.upload('api/upload', avatarUrl, 'image');
      // 微信小程序 image 不支持相对路径，必须转为绝对 URL
      const rawUrl = uploadRes && uploadRes.url ? uploadRes.url : null;
      const serverUrl = rawUrl ? toAbsUrl(rawUrl) : avatarUrl;
      // 2. 保存到用户资料（存入服务器时保存绝对 URL）
      const updated = await api.put('api/auth/me', { avatarUrl: serverUrl });
      this.setData({ userInfo: { ...this.data.userInfo, ...updated, avatarUrl: toAbsUrl(updated.avatarUrl || serverUrl) } });
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch {
      // 上传失败时直接用临时地址展示（刷新后消失，但不报错）
      this.setData({ userInfo: { ...this.data.userInfo, avatarUrl } });
      wx.showToast({ title: '头像已更新（本地）', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // ── 昵称输入 ─────────────────────────────────────────────────────────────────
  onNicknameInput(e) {
    this.setData({ editNickname: e.detail.value });
  },

  async saveProfile() {
    const nickname = this.data.editNickname.trim();
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' }); return;
    }
    this.setData({ savingProfile: true });
    try {
      const updated = await api.put('api/auth/me', { nickname });
      this.setData({
        userInfo: { ...this.data.userInfo, ...updated },
        savingProfile: false,
      });
      wx.showToast({ title: '昵称已保存', icon: 'success' });
    } catch {
      wx.showToast({ title: '保存失败', icon: 'none' });
      this.setData({ savingProfile: false });
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
        if (res.confirm) { clearToken(); wx.reLaunch({ url: '/pages/login/login' }); }
      },
    });
  },
});
