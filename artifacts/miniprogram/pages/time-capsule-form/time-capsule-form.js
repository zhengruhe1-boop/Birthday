const api = require('../../utils/api');
const { isLoggedIn } = require('../../utils/auth');
const { todayStr } = require('../../utils/date');

function toAbsUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const base = 'https://shengritong.kuixi.com';
  return base + (url.startsWith('/') ? '' : '/') + url;
}

Page({
  data: {
    isEdit: false,
    isOpened: false,   // 胶囊已到达开启日期
    capsuleId: null,
    saving: false,
    deleting: false,
    loading: false,

    title: '',
    message: '',
    photoUrls: [],
    openDate: '',
    openTimeVal: '08:00',
    openAt: '',
    reminderEmail: '',
    notifyEnabled: false,
    oaSubscribed: false,
    oaChecked: false,

    uploading: false,
    minDate: todayStr(),
  },

  async onLoad(opts) {
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

    if (opts.id) {
      const id = parseInt(opts.id, 10);
      this.setData({ isEdit: true, capsuleId: id });
      this.loadCapsule(id);
      wx.setNavigationBarTitle({ title: '\u7f16\u8f91\u65f6\u95f4\u80f6\u56ca' });
    } else {
      wx.setNavigationBarTitle({ title: '\u6dfb\u52a0\u65f6\u95f4\u80f6\u56ca' });
    }
    this.loadOaStatus();
  },

  async onShow() {
    if (!this.data.oaChecked) return;
    this.loadOaStatus();
  },

  async loadOaStatus() {
    try {
      const res = await api.get('api/auth/wechat/subscribe-status');
      const subscribed = !!(res && res.subscribed);
      this.setData({ oaSubscribed: subscribed, notifyEnabled: this.data.isEdit ? this.data.notifyEnabled : subscribed, oaChecked: true });
    } catch {
      this.setData({ oaSubscribed: false, oaChecked: true });
    }
  },

  async loadCapsule(id) {
    this.setData({ loading: true });
    try {
      const c = await api.get('api/capsules/' + id);
      const rt = c.openAt || '';
      const parts = rt.split(' ');
      const openDate = parts[0] || '';
      const openTimeVal = parts[1] || '08:00';
      const isOpened = openDate ? openDate <= todayStr() : false;
      this.setData({
        title: c.title || '',
        message: c.message || '',
        photoUrls: Array.isArray(c.photoUrls) ? c.photoUrls.map(toAbsUrl) : [],
        openDate,
        openTimeVal,
        openAt: rt,
        reminderEmail: c.reminderEmail || '',
        notifyEnabled: !!c.notifyEnabled,
        isOpened,
        loading: false,
      });
    } catch {
      wx.showToast({ title: '\u52a0\u8f7d\u5931\u8d25', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onMessageInput(e) {
    this.setData({ message: e.detail.value });
  },

  onEmailInput(e) {
    this.setData({ reminderEmail: e.detail.value });
  },

  onNotifyToggle(e) {
    const val = e.detail.value;
    if (val && !this.data.oaSubscribed) {
      this.setData({ notifyEnabled: false });
      wx.navigateTo({ url: '/pages/follow-oa/follow-oa' });
      return;
    }
    this.setData({ notifyEnabled: val });
  },

  goFollowOa() {
    wx.navigateTo({ url: '/pages/follow-oa/follow-oa' });
  },

  onOpenDateChange(e) {
    const date = e.detail.value;
    const time = this.data.openTimeVal || '08:00';
    this.setData({ openDate: date, openAt: date ? date + ' ' + time : '' });
  },

  onOpenTimeChange(e) {
    const time = e.detail.value;
    const date = this.data.openDate || '';
    this.setData({ openTimeVal: time, openAt: date ? date + ' ' + time : '' });
  },

  choosePhoto() {
    if (this.data.photoUrls.length >= 3) {
      wx.showToast({ title: '\u6700\u591a\u4e0a\u4f20 3 \u5f20\u7167\u7247', icon: 'none' });
      return;
    }
    wx.chooseMedia({
      count: 3 - this.data.photoUrls.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const files = res.tempFiles || [];
        this._uploadPhotos(files);
      },
    });
  },

  async _uploadPhotos(files) {
    this.setData({ uploading: true });
    for (const f of files) {
      try {
        let path = f.tempFilePath;
        try {
          const comp = await new Promise((resolve, reject) => {
            wx.compressImage({ src: path, quality: 80, success: resolve, fail: reject });
          });
          if (comp && comp.tempFilePath) path = comp.tempFilePath;
        } catch { /* ignore */ }

        const upRes = await api.upload('api/upload', path, 'image');
        if (upRes && upRes.url) {
          const absUrl = toAbsUrl(upRes.url);
          const urls = this.data.photoUrls.concat([absUrl]);
          this.setData({ photoUrls: urls });
        }
      } catch (err) {
        wx.showToast({ title: '\u56fe\u7247\u4e0a\u4f20\u5931\u8d25', icon: 'none' });
      }
    }
    this.setData({ uploading: false });
  },

  removePhoto(e) {
    const idx = e.currentTarget.dataset.idx;
    const urls = this.data.photoUrls.slice();
    urls.splice(idx, 1);
    this.setData({ photoUrls: urls });
  },

  previewPhoto(e) {
    const idx = e.currentTarget.dataset.idx;
    wx.previewImage({
      current: this.data.photoUrls[idx],
      urls: this.data.photoUrls,
    });
  },

  validate() {
    const { message, openDate, reminderEmail, isOpened } = this.data;
    if (!message.trim()) {
      wx.showToast({ title: '请写下对未来自己说的话', icon: 'none' });
      return false;
    }
    if (!openDate) {
      wx.showToast({ title: '请设置开启时间', icon: 'none' });
      return false;
    }
    // 已开启的胶囊允许保留原来的（过去）日期
    if (!isOpened && openDate < todayStr()) {
      wx.showToast({ title: '开启时间必须是未来', icon: 'none' });
      return false;
    }
    if (reminderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reminderEmail.trim())) {
      wx.showToast({ title: '邮箱格式不正确', icon: 'none' });
      return false;
    }
    return true;
  },

  buildBody() {
    const d = this.data;
    return {
      title: d.title.trim() || undefined,
      message: d.message.trim(),
      photoUrls: d.photoUrls,
      openAt: d.openAt,
      reminderEmail: d.reminderEmail.trim() || undefined,
      notifyEnabled: d.notifyEnabled,
    };
  },

  async handleSave() {
    if (!this.validate()) return;
    this.setData({ saving: true });
    try {
      const { track } = require('../../utils/track');
      const body = this.buildBody();
      if (this.data.isEdit) {
        await api.put('api/capsules/' + this.data.capsuleId, body);
        wx.showToast({ title: '\u4fdd\u5b58\u6210\u529f', icon: 'success' });
      } else {
        await api.post('api/capsules', body);
        track('capsule_create');
        wx.showToast({ title: '\u6dfb\u52a0\u6210\u529f', icon: 'success' });
      }
      setTimeout(() => wx.navigateBack(), 800);
    } catch (err) {
      wx.showToast({ title: (err && err.message) || '\u4fdd\u5b58\u5931\u8d25', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  handleDelete() {
    wx.showModal({
      title: '\u5220\u9664\u65f6\u95f4\u80f6\u56ca',
      content: '\u786e\u5b9a\u8981\u5220\u9664\u8fd9\u4e2a\u65f6\u95f4\u80f6\u56ca\u5417\uff1f',
      confirmText: '\u5220\u9664',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ deleting: true });
          try {
            await api.del('api/capsules/' + this.data.capsuleId);
            wx.showToast({ title: '\u5df2\u5220\u9664', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 800);
          } catch {
            wx.showToast({ title: '\u5220\u9664\u5931\u8d25', icon: 'none' });
            this.setData({ deleting: false });
          }
        }
      },
    });
  },
});
