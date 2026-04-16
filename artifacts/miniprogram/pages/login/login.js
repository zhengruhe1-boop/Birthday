const api = require('../../utils/api');
const { setToken, isLoggedIn } = require('../../utils/auth');

Page({
  data: {
    checkingSession: true,
    loading: false,
    networkError: '',

    // legal modal
    showLegal: false,
    legalTitle: '',
    legalContent: '',
    legalLoading: false,
  },

  async onLoad() {
    const app = getApp();
    let loggedIn = false;
    if (app && app.globalData.sessionReady) {
      loggedIn = await app.globalData.sessionReady;
    } else {
      loggedIn = isLoggedIn();
    }
    if (loggedIn) {
      wx.reLaunch({ url: '/pages/home/home' });
      return;
    }
    this.setData({ checkingSession: false });
  },

  // ── 微信一键授权登录 ──────────────────────────────────────────────────────────
  async handleWxLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true, networkError: '' });
    try {
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({ timeout: 10000, success: resolve, fail: reject });
      });

      const res = await api.post('api/auth/wechat/login', { code: loginRes.code });
      setToken(res.token);

      if (res.user) {
        wx.setStorageSync('birthday_userinfo', res.user);
      }

      const app = getApp();
      if (app) app.globalData.sessionReady = Promise.resolve(true);

      wx.reLaunch({ url: '/pages/home/home' });
    } catch (err) {
      const msg = err.message || err.errMsg || String(err) || '';
      if (msg.includes('timeout')) {
        this.setData({ networkError: '⚠️ 网络超时，请检查网络连接后重试' });
      } else if (msg.includes('url not in domain') || msg.includes('白名单') || msg.includes('domain') || msg.includes('invalid url')) {
        this.setData({
          networkError: '⚠️ 无法连接服务器\n开发者工具「详情→本地设置」请勾选\n「不校验合法域名」',
        });
      } else if (msg.includes('invalid appid') || msg.includes('40013')) {
        this.setData({
          networkError: '⚠️ 小程序 AppID 配置错误\n请在管理后台「微信配置」中检查\n小程序 AppID 与 AppSecret 是否正确',
        });
      } else if (msg.includes('invalid js code') || msg.includes('40029') || msg.includes('45011')) {
        this.setData({ networkError: '⚠️ 授权码已过期，请重新点击登录' });
      } else if (msg.includes('fail') || msg.includes('network')) {
        this.setData({ networkError: '⚠️ 网络异常，请稍后重试' });
      } else {
        this.setData({ networkError: '⚠️ 登录失败：' + (msg || '请稍后重试') });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  // ── 用户协议 ──────────────────────────────────────────────────────────────────
  async showTerms() {
    this.setData({ showLegal: true, legalTitle: '用户协议', legalContent: '', legalLoading: true });
    try {
      const data = await api.get('api/auth/legal');
      this.setData({
        legalContent: data.termsOfService || '暂无内容，管理员尚未配置。',
        legalLoading: false,
      });
    } catch {
      this.setData({ legalContent: '暂无内容，管理员尚未配置。', legalLoading: false });
    }
  },

  // ── 隐私政策 ──────────────────────────────────────────────────────────────────
  async showPrivacy() {
    this.setData({ showLegal: true, legalTitle: '隐私政策', legalContent: '', legalLoading: true });
    try {
      const data = await api.get('api/auth/legal');
      this.setData({
        legalContent: data.privacyPolicy || '暂无内容，管理员尚未配置。',
        legalLoading: false,
      });
    } catch {
      this.setData({ legalContent: '暂无内容，管理员尚未配置。', legalLoading: false });
    }
  },

  closeLegal() { this.setData({ showLegal: false, legalLoading: false }); },
});
