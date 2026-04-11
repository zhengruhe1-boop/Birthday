const api = require('../../utils/api');
const { setToken, getOrCreateDeviceId, isLoggedIn } = require('../../utils/auth');

Page({
  data: {
    nickname: '',
    loginMode: 'mock',
    loading: false,
    wxLoginLoading: false,
    networkError: '',
    showLegal: false,
    legalTitle: '',
    legalContent: '',
  },

  onLoad() {
    if (isLoggedIn()) {
      wx.reLaunch({ url: '/pages/home/home' });
      return;
    }
    // 非关键请求：延迟加载，不阻塞页面渲染
    setTimeout(() => this.loadConfig(), 300);
    setTimeout(() => this.loadLegal(), 800);
  },

  async loadConfig() {
    try {
      const data = await api.get('api/auth/wechat/public-config');
      this.setData({ loginMode: data.loginMode || 'mock', networkError: '' });
    } catch (err) {
      // 连接失败时在页面展示提示，而不是弹 Toast
      const msg = err.message || '';
      if (msg.includes('白名单') || msg.includes('domain') || msg.includes('timeout') || msg.includes('fail')) {
        this.setData({
          networkError: '⚠️ 无法连接服务器\n请在开发者工具「详情 → 本地设置」勾选\n✅ 不校验合法域名',
        });
      }
    }
  },

  async loadLegal() {
    try {
      const data = await api.get('api/auth/legal');
      this.setData({ legalContent: data.termsOfService || '' });
    } catch {}
  },

  onNicknameInput(e) { this.setData({ nickname: e.detail.value }); },

  async handleQuickLogin() {
    this.setData({ loading: true, networkError: '' });
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await api.post('api/auth/mock-login', { nickname: '微信用户', deviceId });
      setToken(res.token);
      wx.reLaunch({ url: '/pages/home/home' });
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('白名单') || msg.includes('domain') || msg.includes('timeout') || msg.includes('fail')) {
        this.setData({
          networkError: '⚠️ 无法连接服务器\n请在开发者工具「详情 → 本地设置」勾选\n✅ 不校验合法域名',
        });
      } else {
        this.setData({ networkError: '登录失败：' + msg });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  async handleNicknameLogin() {
    const nickname = this.data.nickname.trim() || '微信用户';
    this.setData({ loading: true, networkError: '' });
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await api.post('api/auth/mock-login', { nickname, deviceId });
      setToken(res.token);
      wx.reLaunch({ url: '/pages/home/home' });
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('白名单') || msg.includes('domain') || msg.includes('timeout') || msg.includes('fail')) {
        this.setData({
          networkError: '⚠️ 无法连接服务器\n请在开发者工具「详情 → 本地设置」勾选\n✅ 不校验合法域名',
        });
      } else {
        this.setData({ networkError: '登录失败：' + msg });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  async handleWxLogin() {
    this.setData({ wxLoginLoading: true, networkError: '' });
    try {
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({ success: resolve, fail: reject });
      });
      const res = await api.post('api/auth/wechat/login', { code: loginRes.code });
      setToken(res.token);
      wx.reLaunch({ url: '/pages/home/home' });
    } catch (err) {
      this.setData({ networkError: '微信登录失败：' + (err.message || '请重试') });
    } finally {
      this.setData({ wxLoginLoading: false });
    }
  },

  showTerms() {
    this.setData({ showLegal: true, legalTitle: '用户协议', legalContent: this.data.legalContent || '暂无内容' });
  },

  showPrivacy() {
    this.setData({ showLegal: true, legalTitle: '隐私政策', legalContent: '暂无内容，管理员尚未配置。' });
  },

  closeLegal() { this.setData({ showLegal: false }); },
});
