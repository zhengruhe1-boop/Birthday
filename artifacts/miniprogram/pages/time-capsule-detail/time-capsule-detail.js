const api = require('../../utils/api');
const { isLoggedIn } = require('../../utils/auth');

function toAbsUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return 'https://shengritong.kuixi.com' + (url.startsWith('/') ? '' : '/') + url;
}

function daysLabel(openAt) {
  if (!openAt) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(openAt.slice(0, 10) + 'T00:00:00');
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return '已可开启';
  if (diff === 0) return '今天开启';
  if (diff === 1) return '明天开启';
  return diff + ' 天后开启';
}

Page({
  data: {
    loading: true,
    deleting: false,
    capsuleId: null,
    capsule: null,
    daysLabel: '',
    isOpened: false,
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
      this.setData({ capsuleId: id });
      this.loadCapsule(id);
    }
  },

  onShow() {
    if (this.data.capsuleId) {
      this.loadCapsule(this.data.capsuleId);
    }
  },

  async loadCapsule(id) {
    this.setData({ loading: true });
    try {
      const c = await api.get('api/capsules/' + id);
      const photoUrls = Array.isArray(c.photoUrls) ? c.photoUrls.map(toAbsUrl) : [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const target = new Date((c.openAt || '').slice(0, 10) + 'T00:00:00');
      const isOpened = target <= today;
      this.setData({
        capsule: { ...c, photoUrls },
        daysLabel: daysLabel(c.openAt),
        isOpened,
        loading: false,
      });
      wx.setNavigationBarTitle({ title: c.title || '时间胶囊' });
    } catch {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  goEdit() {
    wx.navigateTo({
      url: '/pages/time-capsule-form/time-capsule-form?id=' + this.data.capsuleId,
    });
  },

  handleDelete() {
    wx.showModal({
      title: '删除时间胶囊',
      content: '确定要删除这个时间胶囊吗？删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ deleting: true });
          try {
            await api.del('api/capsules/' + this.data.capsuleId);
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 800);
          } catch {
            wx.showToast({ title: '删除失败', icon: 'none' });
            this.setData({ deleting: false });
          }
        }
      },
    });
  },

  previewPhoto(e) {
    const idx = e.currentTarget.dataset.idx;
    wx.previewImage({
      current: this.data.capsule.photoUrls[idx],
      urls: this.data.capsule.photoUrls,
    });
  },

  onShareAppMessage() {
    return {
      title: '生日通 · 时间胶囊',
      path: '/pages/home/home',
    };
  },
});
