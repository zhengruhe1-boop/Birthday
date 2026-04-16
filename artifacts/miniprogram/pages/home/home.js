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

// 清理微信系统占位文字，视为未设置昵称
const INVALID_NICKNAMES = ['获取微信昵称', '微信昵称', '用户昵称'];
function cleanNickname(nickname) {
  const s = (nickname || '').trim();
  return INVALID_NICKNAMES.includes(s) ? '' : s;
}

// 构建显示用的问候语
function buildDisplayNickname(nickname) {
  const name = cleanNickname(nickname);
  return name ? '您好！' + name : '您好！欢迎使用生日通';
}

const PREF_EMAIL_NOTIFY = 'birthday_pref_email_notify';
const DEFAULT_AVATAR = '/images/logo.jpg';

// 只有以 http 开头的才算有效服务器 URL，否则用默认 logo
function toDisplayAvatar(url) {
  return (url && url.startsWith('http')) ? url : '';
}

Page({
  data: {
    userInfo: null,
    displayNickname: '您好！欢迎使用生日通',
    displayAvatarUrl: '',   // 空串 → wxml 里显示 logo.jpg；http URL → 显示上传头像
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

    // 键盘高度（px）：用于在昵称输入时把设置弹窗上移，避免被键盘遮挡
    keyboardHeight: 0,
    // scroll-into-view 目标 id：键盘弹出时滚动到昵称区域
    nicknameScrollAnchor: '',
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
      const cachedAvatarUrl = toAbsUrl(cached.avatarUrl);
      const cachedNorm = { ...cached, avatarUrl: cachedAvatarUrl };
      this.setData({
        userInfo: cachedNorm,
        displayAvatarUrl: toDisplayAvatar(cachedAvatarUrl),
        editNickname: cleanNickname(cached.nickname),
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
        displayAvatarUrl: toDisplayAvatar(meNormalized ? meNormalized.avatarUrl : ''),
        editNickname: cleanNickname(me ? me.nickname : ''),
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

  // ── 头像：点击触发相册选图（兼容新旧版微信）────────────────────────────────
  async chooseAvatar() {
    const prevAvatarUrl = this.data.displayAvatarUrl || null;

    try {
      let tempUrl = '';
      if (wx.chooseMedia) {
        // 基础库 2.10.0+
        const res = await new Promise((resolve, reject) => {
          wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            success: resolve,
            fail: reject,
          });
        });
        tempUrl = res.tempFiles[0].tempFilePath;
      } else {
        // 旧版基础库兼容
        const res = await new Promise((resolve, reject) => {
          wx.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera'],
            success: resolve,
            fail: reject,
          });
        });
        tempUrl = res.tempFilePaths[0];
      }
      await this._uploadAndSaveAvatar(tempUrl, prevAvatarUrl);
    } catch (err) {
      const msg = (err && (err.errMsg || err.message)) || '';
      if (msg.includes('cancel')) return;
      wx.showToast({ title: '选择图片失败', icon: 'none' });
    }
  },

  // ── 头像：通用上传保存逻辑 ────────────────────────────────────────────────────
  async _uploadAndSaveAvatar(tempUrl, prevAvatarUrl) {
    if (!tempUrl) return;
    // 临时路径仅用于预览，不写 DB
    this.setData({
      userInfo: { ...(this.data.userInfo || {}), avatarUrl: tempUrl },
      displayAvatarUrl: tempUrl,
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
      this.setData({
        userInfo: finalInfo,
        displayAvatarUrl: toDisplayAvatar(serverUrl),
        avatarUploading: false,
      });
      wx.setStorageSync('birthday_userinfo', finalInfo);
      this._lastSavedAvatarUrl = serverUrl;
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch (err) {
      const errMsg = (err && err.message) || '头像上传失败，请重试';
      this.setData({
        userInfo: { ...(this.data.userInfo || {}), avatarUrl: prevAvatarUrl || '' },
        displayAvatarUrl: toDisplayAvatar(prevAvatarUrl || ''),
        avatarUploading: false,
      });
      wx.showToast({ title: errMsg.length > 14 ? '头像上传失败，请重试' : errMsg, icon: 'none' });
    } finally {
      this._avatarUploading = false;
    }
  },

  // ── 头像图片加载失败时（URL 过期/失效）回退到 logo ──────────────────────────
  onAvatarImgError() {
    this.setData({ displayAvatarUrl: '' });
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

  // ── 键盘高度变化：弹窗动态上移 + 滚动到昵称区域，保持内容可见 ──────────────────
  onNicknameKeyboardChange(e) {
    const h = e.detail.height || 0;
    this.setData({
      keyboardHeight: h,
      // 键盘弹出时滚到昵称区域，键盘收起时清空锚点
      nicknameScrollAnchor: h > 0 ? 'nickname-anchor' : '',
    });
  },

  // ── 昵称：手动点击保存按钮（始终可见）──────────────────────────────────────
  async saveNickname() {
    const nickname = (this.data.editNickname || '').trim();
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    this.setData({ nicknameChanged: false });
    await this._saveNickname(nickname);
  },

  // ── 昵称：公共保存逻辑 ────────────────────────────────────────────────────────
  async _saveNickname(nickname) {
    try {
      const updated = await api.put('api/auth/me', { nickname });
      const currentAvatarUrl = (this.data.userInfo && this.data.userInfo.avatarUrl) || '';
      const serverAvatarUrl = toAbsUrl(updated.avatarUrl);
      const finalAvatarUrl = serverAvatarUrl || currentAvatarUrl;
      const newInfo = {
        ...(this.data.userInfo || {}),
        ...updated,
        avatarUrl: finalAvatarUrl,
      };
      this.setData({
        userInfo: newInfo,
        displayAvatarUrl: toDisplayAvatar(finalAvatarUrl),
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
      editNickname: cleanNickname(this.data.userInfo && this.data.userInfo.nickname),
      nicknameChanged: false,
    });
  },
  closeSettings(){ this.setData({ showSettings: false, keyboardHeight: 0, nicknameScrollAnchor: '' }); },
  goSubscribePage() { this.closeSettings(); wx.navigateTo({ url: '/pages/subscribe/subscribe' }); },

  toggleEmailNotify(e) {
    const v = e.detail.value;
    this.setData({ emailNotify: v });
    wx.setStorageSync(PREF_EMAIL_NOTIFY, v ? 'true' : 'false');
  },

  // ── 事件冒泡拦截（防止弹窗内点击穿透到遮罩） ──────────────────────────────────
  noop() {},

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
