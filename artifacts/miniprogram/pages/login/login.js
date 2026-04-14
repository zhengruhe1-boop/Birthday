const api = require('../../utils/api');
const { setToken, getOrCreateDeviceId, isLoggedIn } = require('../../utils/auth');

Page({
  data: {
    // step: 'login' | 'profile'
    step: 'login',

    // 等待 sessionReady 期间显示 loading，避免闪烁
    checkingSession: true,

    // login step
    loading: false,
    networkError: '',

    // profile step
    avatarUrl: '',
    nickname: '',
    savingProfile: false,
    isNewUser: false,

    // legal modal
    showLegal: false,
    legalTitle: '',
    legalContent: '',
    legalLoading: false,
  },

  async onLoad() {
    // 等待 app.js 的无感知自动登录完成，期间显示 loading 避免登录页闪烁
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
    // 未登录：显示登录页
    this.setData({ checkingSession: false });
  },

  // ── 微信一键授权登录（点击即视为同意协议）─────────────────────────────────
  async handleWxLogin() {
    if (this.data.loading) return;

    this.setData({ loading: true, networkError: '' });
    try {
      // 1. 获取微信 code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({ timeout: 10000, success: resolve, fail: reject });
      });

      // 2. 换取 token
      const res = await api.post('api/auth/wechat/login', { code: loginRes.code });
      setToken(res.token);

      // 3. 保存用户信息
      if (res.user) {
        wx.setStorageSync('birthday_userinfo', res.user);
      }

      // 4. 登录成功，直接进入首页
      wx.reLaunch({ url: '/pages/home/home' });
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('timeout') || msg.includes('fail') || msg.includes('domain') || msg.includes('白名单')) {
        this.setData({
          networkError: '⚠️ 无法连接服务器\n开发者工具「详情→本地设置」请勾选\n「不校验合法域名」',
        });
      } else if (msg.includes('invalid appid') || msg.includes('40013')) {
        this.setData({
          networkError: '⚠️ 小程序 AppID 配置错误\n请在管理后台「微信配置」中检查\n小程序 AppID 与 AppSecret 是否正确',
        });
      } else if (msg.includes('invalid js code') || msg.includes('40029') || msg.includes('45011')) {
        this.setData({ networkError: '授权码已过期，请重试' });
      } else {
        this.setData({ networkError: '授权失败：' + (msg || '请重试') });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  // ── 资料步骤：选微信头像 ────────────────────────────────────────────────
  onChooseAvatar(e) {
    const url = e.detail.avatarUrl;
    if (!url) return;
    this.setData({ avatarUrl: url });
  },

  // ── 资料步骤：输入昵称 ──────────────────────────────────────────────────
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  // ── 资料步骤：完成 ──────────────────────────────────────────────────────
  async handleSaveProfile() {
    if (this.data.savingProfile) return;
    const nickname = this.data.nickname.trim() || '微信用户';
    const avatarUrl = this.data.avatarUrl || '';

    this.setData({ savingProfile: true });
    try {
      const updated = await api.put('api/auth/me', { nickname, avatarUrl });
      wx.setStorageSync('birthday_userinfo', updated);
      wx.reLaunch({ url: '/pages/home/home' });
    } catch (err) {
      // 即使保存失败也放行，资料可以在设置里改
      wx.reLaunch({ url: '/pages/home/home' });
    }
  },

  // ── 跳过资料 ────────────────────────────────────────────────────────────
  handleSkipProfile() {
    wx.reLaunch({ url: '/pages/home/home' });
  },

  // ── 用户协议（从管理后台获取）──────────────────────────────────────────
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

  // ── 隐私政策（从管理后台获取）──────────────────────────────────────────
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
