const api = require('../../utils/api');
const { isLoggedIn } = require('../../utils/auth');

// 将相对路径转为绝对 URL（微信小程序 image 不支持相对路径）
function toAbsUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const base = (getApp().globalData.apiBase || '').replace(/\/$/, '');
  return base + (url.startsWith('/') ? url : '/' + url);
}

const MONTHS = ['1','2','3','4','5','6','7','8','9','10','11','12'];
const DAYS   = Array.from({ length: 31 }, (_, i) => String(i + 1));
const RELATIONS = ['家人', '朋友', '同事', '恋人', '同学', '其他'];

function getZodiac(month, day) {
  const signs = [
    { name: '摩羯座', m: 1, d: 20 }, { name: '水瓶座', m: 2, d: 19 },
    { name: '双鱼座', m: 3, d: 20 }, { name: '白羊座', m: 4, d: 20 },
    { name: '金牛座', m: 5, d: 21 }, { name: '双子座', m: 6, d: 21 },
    { name: '巨蟹座', m: 7, d: 23 }, { name: '狮子座', m: 8, d: 23 },
    { name: '处女座', m: 9, d: 23 }, { name: '天秤座', m: 10, d: 23 },
    { name: '天蝎座', m: 11, d: 22 }, { name: '射手座', m: 12, d: 22 },
    { name: '摩羯座', m: 1, d: 31 },
  ];
  for (const s of signs) {
    if (month < s.m || (month === s.m && day < s.d)) return s.name;
  }
  return '摩羯座';
}

Page({
  data: {
    isEdit: false,
    contactId: null,
    loading: false,
    saving: false,
    deleting: false,

    // Form fields
    name: '',
    gender: '',
    birthdayMonth: 1,
    birthdayDay: 1,
    birthdayLunar: false,
    birthYear: '',
    relation: '',
    hometown: '',
    reminderEmail: '',
    avatarUrl: null,
    avatarUploading: false,

    // Picker data
    monthIndex: 0,
    dayIndex: 0,
    months: MONTHS,
    days: DAYS,
    relationOptions: RELATIONS,

    // Zodiac
    zodiac: '',

    // AI events
    aiEvents: [],
    aiLoading: false,
    aiError: '',
    showAiEvents: true,

    // Test email
    testEmailStatus: 'idle',
    testEmailMsg: '',

    // 消息通知
    oaSubscribed: false,
    notifyEnabled: false,
    oaChecked: false,
  },

  onLoad(opts) {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    const id = opts.id;
    if (id && id !== 'new') {
      this.setData({ isEdit: true, contactId: parseInt(id, 10) });
      wx.setNavigationBarTitle({ title: '编辑生日' });
      this.loadContact(parseInt(id, 10));
    } else {
      wx.setNavigationBarTitle({ title: '添加生日' });
      const now = new Date();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      this.setData({
        birthdayMonth: m, birthdayDay: d,
        monthIndex: m - 1, dayIndex: d - 1,
        zodiac: getZodiac(m, d),
      });
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
      this.setData({ oaSubscribed: subscribed, notifyEnabled: subscribed, oaChecked: true });
    } catch {
      this.setData({ oaSubscribed: false, notifyEnabled: false, oaChecked: true });
    }
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

  async loadContact(id) {
    this.setData({ loading: true });
    try {
      const c = await api.get('api/contacts/' + id);
      const m = c.birthdayMonth;
      const d = c.birthdayDay;
      // 读取已保存的历史事件（服务端已持久化，无需每次重新生成）
      const savedEvents = Array.isArray(c.birthdayEvents) ? c.birthdayEvents : [];
      this.setData({
        name: c.name || '',
        gender: c.gender || '',
        birthdayMonth: m,
        birthdayDay: d,
        birthdayLunar: !!c.birthdayLunar,
        birthYear: c.birthYear ? String(c.birthYear) : '',
        relation: c.relation || '',
        hometown: c.hometown || '',
        reminderEmail: c.reminderEmail || '',
        avatarUrl: toAbsUrl(c.avatarUrl) || null,
        monthIndex: m - 1,
        dayIndex: d - 1,
        zodiac: getZodiac(m, d),
        aiEvents: savedEvents,
        showAiEvents: true,
        loading: false,
      });
    } catch {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onBirthYearInput(e) { this.setData({ birthYear: e.detail.value }); },
  onHometownInput(e) { this.setData({ hometown: e.detail.value }); },
  onEmailInput(e) { this.setData({ reminderEmail: e.detail.value }); },

  setGender(e) { this.setData({ gender: e.currentTarget.dataset.val }); },

  toggleLunar() {
    this.setData({ birthdayLunar: !this.data.birthdayLunar });
  },

  onMonthChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const m = idx + 1;
    this.setData({ monthIndex: idx, birthdayMonth: m, zodiac: getZodiac(m, this.data.birthdayDay) });
  },

  onDayChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const d = idx + 1;
    this.setData({ dayIndex: idx, birthdayDay: d, zodiac: getZodiac(this.data.birthdayMonth, d) });
  },

  onRelationChange(e) {
    this.setData({ relation: RELATIONS[parseInt(e.detail.value, 10)] });
  },

  async chooseAvatar() {
    // 记住上传前已有的服务器 URL，失败时恢复，避免临时路径残留
    const prevAvatarUrl = (this.data.avatarUrl && this.data.avatarUrl.startsWith('http'))
      ? this.data.avatarUrl : null;

    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        });
      });
      const tempFile = res.tempFiles[0].tempFilePath;

      // ① 仅更新 UI 预览，不写入缓存（临时路径重启后失效）
      this.setData({ avatarUrl: tempFile, avatarUploading: true });

      // ② 新联系人先保存基础信息，再上传头像
      if (!this.data.contactId) {
        const saved = await this.saveContactForAvatar();
        if (!saved) {
          this.setData({ avatarUrl: prevAvatarUrl, avatarUploading: false });
          return;
        }
      }

      // ③ 上传到服务器
      const uploadRes = await api.upload('api/upload', tempFile, 'image');
      if (!uploadRes || !uploadRes.url) throw new Error('服务器未返回图片地址');

      const absUrl = toAbsUrl(uploadRes.url);
      // ④ 直接写入联系人记录（与 handleSave 独立，不依赖 buildBody）
      await api.put('api/contacts/' + this.data.contactId, { avatarUrl: absUrl });
      this.setData({ avatarUrl: absUrl, avatarUploading: false });
      wx.showToast({ title: '头像已更新', icon: 'success' });
    } catch (err) {
      // 上传失败：恢复旧头像，避免临时路径留在 data 里被 handleSave 写入 DB
      this.setData({ avatarUrl: prevAvatarUrl, avatarUploading: false });
      if (err && err.errMsg && err.errMsg.includes('cancel')) return;
      wx.showToast({ title: '头像上传失败，请重试', icon: 'none' });
    }
  },

  async saveContactForAvatar() {
    const body = this.buildBody();
    if (!body.name) { wx.showToast({ title: '请先填写姓名', icon: 'none' }); return null; }
    try {
      const res = await api.post('api/contacts', body);
      this.setData({ isEdit: true, contactId: res.id });
      return res;
    } catch {
      wx.showToast({ title: '保存失败', icon: 'none' });
      return null;
    }
  },

  async loadAiEvents() {
    if (!this.data.contactId) {
      wx.showToast({ title: '请先保存联系人', icon: 'none' });
      return;
    }
    this.setData({ aiLoading: true, aiError: '', showAiEvents: true });
    try {
      const res = await api.post('api/contacts/' + this.data.contactId + '/birthday-events', {});
      // 服务器返回 { events: [...] }，取 events 数组
      const events = (res && Array.isArray(res.events)) ? res.events : (Array.isArray(res) ? res : []);
      this.setData({ aiEvents: events, aiLoading: false });
    } catch (err) {
      this.setData({ aiError: err.message || '获取失败', aiLoading: false });
    }
  },

  toggleAiEvents() {
    // 仅切换展开/收起，不自动加载，由用户点击"生成"按钮触发加载
    this.setData({ showAiEvents: !this.data.showAiEvents });
  },

  async sendTestEmail() {
    if (!this.data.reminderEmail) {
      wx.showToast({ title: '请先填写邮箱', icon: 'none' });
      return;
    }
    if (!this.data.contactId) {
      wx.showToast({ title: '请先保存联系人', icon: 'none' });
      return;
    }
    this.setData({ testEmailStatus: 'sending' });
    try {
      const res = await api.post('api/contacts/' + this.data.contactId + '/test-email', {});
      this.setData({ testEmailStatus: 'success', testEmailMsg: res.message || '邮件已发送' });
      setTimeout(() => this.setData({ testEmailStatus: 'idle' }), 4000);
    } catch (err) {
      this.setData({ testEmailStatus: 'error', testEmailMsg: err.message || '发送失败' });
      setTimeout(() => this.setData({ testEmailStatus: 'idle' }), 4000);
    }
  },

  buildBody() {
    const d = this.data;
    // 只有 http(s) 开头的服务器永久 URL 才写入 DB；
    // 微信临时路径（wxfile://tmp/...）或 null 均不保存，防止刷新后图片消失
    const safeAvatar = (d.avatarUrl && d.avatarUrl.startsWith('http')) ? d.avatarUrl : null;
    return {
      name: d.name.trim(),
      gender: d.gender || null,
      birthdayMonth: d.birthdayMonth,
      birthdayDay: d.birthdayDay,
      birthdayLunar: d.birthdayLunar,
      birthYear: d.birthYear ? parseInt(d.birthYear, 10) : null,
      relation: d.relation || null,
      hometown: d.hometown.trim() || null,
      reminderEmail: d.reminderEmail.trim() || null,
      avatarUrl: safeAvatar,
    };
  },

  validate() {
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return false;
    }
    const email = this.data.reminderEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      wx.showToast({ title: '邮箱格式不正确', icon: 'none' });
      return false;
    }
    return true;
  },

  async handleSave() {
    if (!this.validate()) return;
    this.setData({ saving: true });
    try {
      const body = this.buildBody();
      if (this.data.isEdit) {
        await api.put('api/contacts/' + this.data.contactId, body);
        wx.showToast({ title: '保存成功', icon: 'success' });
      } else {
        await api.post('api/contacts', body);
        wx.showToast({ title: '添加成功', icon: 'success' });
      }
      setTimeout(() => wx.navigateBack(), 800);
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  handleBack() { wx.navigateBack(); },

  async handleDelete() {
    wx.showModal({
      title: '删除联系人',
      content: '确定要删除"' + this.data.name + '"吗？此操作不可恢复。',
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ deleting: true });
          try {
            await api.del('api/contacts/' + this.data.contactId);
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
});
