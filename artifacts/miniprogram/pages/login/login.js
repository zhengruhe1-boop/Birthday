const api = require('../../utils/api');
const { setToken, getOrCreateDeviceId, isLoggedIn } = require('../../utils/auth');

Page({
  data: {
    // step: 'login' | 'profile'
    step: 'login',

    // login step
    loading: false,
    networkError: '',
    agreed: false,

    // profile step
    avatarUrl: '',
    nickname: '',
    savingProfile: false,
    isNewUser: false,

    // legal modal
    showLegal: false,
    legalTitle: '',
    legalContent: '',
  },

  onLoad() {
    if (isLoggedIn()) {
      wx.reLaunch({ url: '/pages/home/home' });
    }
  },

  // ── 协议勾选 ──────────────────────────────────────────────────────────────
  toggleAgreed() {
    this.setData({ agreed: !this.data.agreed });
  },

  // ── 微信一键授权登录 ──────────────────────────────────────────────────────
  async handleWxLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' });
      return;
    }
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

      // 4. 新用户 或 资料缺失 → 进入资料完善步骤
      if (res.needsProfile) {
        this.setData({
          step: 'profile',
          nickname: (res.user && res.user.nickname !== '微信用户' && res.user.nickname !== '匿名用户')
            ? res.user.nickname : '',
          avatarUrl: (res.user && res.user.avatarUrl) ? res.user.avatarUrl : '',
          isNewUser: true,
        });
      } else {
        wx.reLaunch({ url: '/pages/home/home' });
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('timeout') || msg.includes('fail') || msg.includes('domain') || msg.includes('白名单')) {
        this.setData({
          networkError: '⚠️ 无法连接服务器\n开发者工具「详情→本地设置」请勾选\n「不校验合法域名」',
        });
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
    // 临时路径直接用，无需上传（小程序内可访问）
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

  // ── 法律协议 ────────────────────────────────────────────────────────────
  async showTerms() {
    try {
      const data = await api.get('api/auth/legal');
      this.setData({
        showLegal: true,
        legalTitle: '用户协议',
        legalContent: data.termsOfService || '暂无内容，管理员尚未配置。',
      });
    } catch {
      this.setData({ showLegal: true, legalTitle: '用户协议', legalContent: '暂无内容，管理员尚未配置。' });
    }
  },

  showPrivacy() {
    this.setData({ showLegal: true, legalTitle: '隐私政策', legalContent: '暂无内容，管理员尚未配置。' });
  },

  closeLegal() { this.setData({ showLegal: false }); },
});
