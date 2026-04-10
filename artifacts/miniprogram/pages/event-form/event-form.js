const api = require('../../utils/api');
const { isLoggedIn } = require('../../utils/auth');
const { todayStr } = require('../../utils/date');

const TYPE_META = {
  anniversary: { label: '纪念日', icon: '❤️', color: '#f43f5e', bg: '#fff1f2', navTitle: '纪念日' },
  countdown:   { label: '倒数日', icon: '⏱️', color: '#f97316', bg: '#fff7ed', navTitle: '倒数日' },
  other:       { label: '其它提醒', icon: '✨', color: '#8b5cf6', bg: '#f5f3ff', navTitle: '其它提醒' },
};

Page({
  data: {
    isEdit: false,
    eventId: null,
    eventType: 'anniversary',
    meta: TYPE_META.anniversary,
    loading: false,
    saving: false,
    deleting: false,

    // Form
    name: '',
    eventDate: '',
    person: '',
    reminderTime: '',
    reminderEmail: '',

    minDate: todayStr(),
  },

  onLoad(opts) {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    if (opts.id) {
      // Edit mode
      const id = parseInt(opts.id, 10);
      this.setData({ isEdit: true, eventId: id });
      this.loadEvent(id);
    } else {
      // Create mode
      const type = opts.type || 'anniversary';
      this.setData({ eventType: type, meta: TYPE_META[type] });
      wx.setNavigationBarTitle({ title: '添加' + TYPE_META[type].label });
    }
  },

  async loadEvent(id) {
    this.setData({ loading: true });
    try {
      const e = await api.get('api/events/' + id);
      const type = e.type || 'anniversary';
      const meta = TYPE_META[type] || TYPE_META.anniversary;
      this.setData({
        eventType: type,
        meta,
        name: e.name || '',
        eventDate: e.eventDate || '',
        person: e.person || '',
        reminderTime: e.reminderTime || '',
        reminderEmail: e.reminderEmail || '',
        loading: false,
      });
      wx.setNavigationBarTitle({ title: '编辑' + meta.label });
    } catch {
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onPersonInput(e) { this.setData({ person: e.detail.value }); },
  onEmailInput(e) { this.setData({ reminderEmail: e.detail.value }); },

  onDateChange(e) { this.setData({ eventDate: e.detail.value }); },

  onReminderTimeChange(e) {
    // datetime picker returns 'YYYY-MM-DD HH:MM'
    this.setData({ reminderTime: e.detail.value });
  },

  validate() {
    const { name, eventType, eventDate, reminderTime, reminderEmail } = this.data;
    if (!name.trim()) {
      wx.showToast({ title: '请填写名称', icon: 'none' }); return false;
    }
    if ((eventType === 'anniversary' || eventType === 'countdown') && !eventDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' }); return false;
    }
    if (eventType === 'other' && !reminderTime) {
      wx.showToast({ title: '请填写提醒时间', icon: 'none' }); return false;
    }
    const email = reminderEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      wx.showToast({ title: '邮箱格式不正确', icon: 'none' }); return false;
    }
    return true;
  },

  buildBody() {
    const d = this.data;
    return {
      type: d.eventType,
      name: d.name.trim(),
      eventDate: d.eventDate || undefined,
      person: d.person.trim() || undefined,
      reminderTime: d.reminderTime || undefined,
      reminderEmail: d.reminderEmail.trim() || undefined,
    };
  },

  async handleSave() {
    if (!this.validate()) return;
    this.setData({ saving: true });
    try {
      const body = this.buildBody();
      if (this.data.isEdit) {
        await api.put('api/events/' + this.data.eventId, body);
        wx.showToast({ title: '保存成功', icon: 'success' });
      } else {
        await api.post('api/events', body);
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
      title: '删除事件',
      content: '确定要删除"' + this.data.name + '"吗？',
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ deleting: true });
          try {
            await api.del('api/events/' + this.data.eventId);
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
