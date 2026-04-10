const api = require('../../utils/api');
const { setToken, getOrCreateDeviceId, isLoggedIn } = require('../../utils/auth');

Page({
  data: {
    nickname: '',
    loginMode: 'mock',
    loading: false,
    wxLoginLoading: false,
    termsOfService: '',
    privacyPolicy: '',
    showLegal: false,
    legalTitle: '',
    legalContent: '',
  },

  onLoad() {
    if (isLoggedIn()) {
      wx.reLaunch({ url: '/pages/home/home' });
      return;
    }
    this.loadConfig();
    this.loadLegal();
  },

  async loadConfig() {
    try {
      const data = await api.get('api/auth/wechat/public-config');
      this.setData({ loginMode: data.loginMode || 'mock' });
    } catch {
      this.setData({ loginMode: 'mock' });
    }
  },

  async loadLegal() {
    try {
      const data = await api.get('api/auth/legal');
      this.setData({
        termsOfService: data.termsOfService || '',
        privacyPolicy: data.privacyPolicy || '',
      });
    } catch {}
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  async handleQuickLogin() {
    this.setData({ loading: true });
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await api.post('api/auth/mock-login', { nickname: '微信用户', deviceId });
      setToken(res.token);
      wx.reLaunch({ url: '/pages/home/home' });
    } catch (err) {
      wx.showToast({ title: err.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async handleNicknameLogin() {
    const nickname = this.data.nickname.trim() || '微信用户';
    this.setData({ loading: true });
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await api.post('api/auth/mock-login', { nickname, deviceId });
      setToken(res.token);
      wx.reLaunch({ url: '/pages/home/home' });
    } catch (err) {
      wx.showToast({ title: err.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async handleWxLogin() {
    this.setData({ wxLoginLoading: true });
    try {
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject });
      });
      const code = loginRes.code;
      const res = await api.post('api/auth/wechat/login', { code });
      setToken(res.token);
      wx.reLaunch({ url: '/pages/home/home' });
    } catch (err) {
      wx.showToast({ title: err.message || '微信登录失败，请重试', icon: 'none' });
    } finally {
      this.setData({ wxLoginLoading: false });
    }
  },

  showTerms() {
    this.setData({
      showLegal: true,
      legalTitle: '用户协议',
      legalContent: this.data.termsOfService || '暂无内容，管理员尚未配置。',
    });
  },

  showPrivacy() {
    this.setData({
      showLegal: true,
      legalTitle: '隐私政策',
      legalContent: this.data.privacyPolicy || '暂无内容，管理员尚未配置。',
    });
  },

  closeLegal() {
    this.setData({ showLegal: false });
  },
});
