const api = require('../../utils/api');
const { isLoggedIn, clearToken } = require('../../utils/auth');
const { calcAnniversaryYear } = require('../../utils/date');

const PREF_EMAIL_NOTIFY = 'birthday_pref_email_notify';
const MP_FOLLOWED_KEY   = 'birthday_mp_followed';

Page({
  data: {
    userInfo: null,
    search: '',

    // Birthdays
    upcoming: null,
    loadingUpcoming: false,

    // Events
    anniversaries: [],
    countdowns: [],
    others: [],
    loadingEvents: false,

    // Search
    searchContacts: [],
    searchEvents: [],
    searching: false,

    // FAB
    showFab: false,

    // Settings sheet
    showSettings: false,
    emailNotify: true,

    // Follow banner
    mpFollowed: false,

    // Notification prefs
    mpName: '',
  },

  onLoad() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const emailNotify = wx.getStorageSync(PREF_EMAIL_NOTIFY) !== 'false';
    const mpFollowed  = wx.getStorageSync(MP_FOLLOWED_KEY) === '1';
    this.setData({ emailNotify, mpFollowed });
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
        api.get('api/contacts/upcoming').catch(() => ({})),
        api.get('api/events/upcoming').catch(() => ({ anniversaries: [], countdowns: [], others: [] })),
      ]);
      const ann = (events.anniversaries || []).map(e => ({
        ...e,
        anniversaryYear: calcAnniversaryYear(e.eventDate),
      }));
      this.setData({
        userInfo: me,
        upcoming,
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
      const allEvents = [
        ...this.data.anniversaries,
        ...this.data.countdowns,
        ...this.data.others,
      ];
      const matchedEvents = allEvents.filter(e =>
        (e.name || '').toLowerCase().includes(lower) ||
        (e.person || '').toLowerCase().includes(lower)
      );
      this.setData({
        searchContacts: Array.isArray(contacts) ? contacts : [],
        searchEvents: matchedEvents,
        searching: false,
      });
    } catch {
      this.setData({ searching: false });
    }
  },

  // ── Navigation ──────────────────────────────────────────────────────────────
  goAddContact() { wx.navigateTo({ url: '/pages/contact-form/contact-form?id=new' }); this.closeFab(); },
  goAddAnniversary() { wx.navigateTo({ url: '/pages/event-form/event-form?type=anniversary' }); this.closeFab(); },
  goAddCountdown() { wx.navigateTo({ url: '/pages/event-form/event-form?type=countdown' }); this.closeFab(); },
  goAddOther() { wx.navigateTo({ url: '/pages/event-form/event-form?type=other' }); this.closeFab(); },

  goContact(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/contact-form/contact-form?id=' + id });
  },

  goEvent(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/event-form/event-form?id=' + id });
  },

  // ── FAB ─────────────────────────────────────────────────────────────────────
  toggleFab() { this.setData({ showFab: !this.data.showFab }); },
  closeFab() { this.setData({ showFab: false }); },

  // ── Settings ─────────────────────────────────────────────────────────────────
  openSettings() { this.setData({ showSettings: true }); },
  closeSettings() { this.setData({ showSettings: false }); },

  toggleEmailNotify(e) {
    const v = e.detail.value;
    this.setData({ emailNotify: v });
    wx.setStorageSync(PREF_EMAIL_NOTIFY, v ? 'true' : 'false');
  },

  // ── Logout ───────────────────────────────────────────────────────────────────
  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      confirmText: '退出',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          clearToken();
          wx.reLaunch({ url: '/pages/login/login' });
        }
      },
    });
  },

  // ── Helpers for template ─────────────────────────────────────────────────────
  daysUntilLabel(days) {
    if (days === 0) return '今天';
    if (days === 1) return '明天';
    return days + ' 天后';
  },
});
