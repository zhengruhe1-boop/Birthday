const api = require('../../utils/api');
const { isLoggedIn } = require('../../utils/auth');

const MP_TEMPLATE_ID = 'vpfpK6EUtYVem_oGGaweNmz7C3uQ_9oaG9dbh2H81oQ';

Page({
  data: {
    subscribed: false,
    subscribeCount: 0,
    loading: true,
    requesting: false,
  },

  onLoad() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.loadInfo();
  },

  onShow() {
    if (!isLoggedIn()) return;
    this.loadInfo();
  },

  async loadInfo() {
    this.setData({ loading: true });
    try {
      const info = await api.get('api/auth/mp-subscribe-info');
      this.setData({
        subscribed: info.subscribed || false,
        subscribeCount: info.subscribeCount || 0,
        loading: false,
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  async handleSubscribe() {
    if (this.data.requesting) return;
    this.setData({ requesting: true });
    try {
      await new Promise((resolve, reject) => {
        wx.requestSubscribeMessage({
          tmplIds: [MP_TEMPLATE_ID],
          success(res) {
            if (res[MP_TEMPLATE_ID] === 'accept') {
              resolve(true);
            } else {
              reject(new Error('用户未授权'));
            }
          },
          fail(err) {
            reject(err);
          },
        });
      });

      await api.post('api/auth/mp-subscribe', { templateId: MP_TEMPLATE_ID });
      await this.loadInfo();
      wx.showToast({ title: '订阅成功', icon: 'success' });
    } catch (err) {
      const msg = err && err.message ? err.message : '订阅失败';
      if (msg !== '用户未授权') {
        wx.showToast({ title: msg, icon: 'none' });
      }
    } finally {
      this.setData({ requesting: false });
    }
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },

  onShareAppMessage() {
    return {
      title: '生日通 — 再也不错过重要纪念日',
      path: '/pages/home/home',
      imageUrl: '/images/logo.jpg',
    };
  },

  onShareTimeline() {
    return {
      title: '生日通 — 再也不错过重要纪念日',
      imageUrl: '/images/logo.jpg',
    };
  },
});
