const api = require('../../utils/api');

Page({
  data: {
    type: 'agreement',
    title: '用户协议',
    content: '',
    loading: true,
    error: false,
  },

  async onLoad(opts) {
    const type = opts.type || 'agreement';
    const title = type === 'privacy' ? '隐私政策' : '用户协议';
    this.setData({ type, title });
    wx.setNavigationBarTitle({ title });
    await this._loadContent(type);
  },

  async _loadContent(type) {
    this.setData({ loading: true, error: false });
    try {
      const data = await api.get('api/auth/legal');
      const content =
        type === 'privacy'
          ? (data.privacyPolicy || '暂无内容，管理员尚未配置。')
          : (data.termsOfService || '暂无内容，管理员尚未配置。');
      this.setData({ content, loading: false });
    } catch {
      this.setData({ content: '', loading: false, error: true });
    }
  },

  retry() {
    this._loadContent(this.data.type);
  },
});
