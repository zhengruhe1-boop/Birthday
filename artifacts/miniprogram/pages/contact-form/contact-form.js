const api = require("../../utils/api");
const { isLoggedIn } = require("../../utils/auth");

const RELATIONS = ["家人", "朋友", "同事", "恋人", "同学", "其他"];
const GENDERS = [
  { value: "male",    label: "男" },
  { value: "female",  label: "女" },
  { value: "unknown", label: "未知" },
];
const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: (i + 1) + "月",
}));

function getDaysInMonth(month, isLunar) {
  if (isLunar) return 30; // 农历每月最多30天
  const map = { 1:31, 2:29, 3:31, 4:30, 5:31, 6:30, 7:31, 8:31, 9:30, 10:31, 11:30, 12:31 };
  return map[month] || 31;
}

function buildDays(month, isLunar) {
  const count = getDaysInMonth(month, isLunar);
  return Array.from({ length: count }, (_, i) => ({
    value: i + 1,
    label: (i + 1) + "日",
  }));
}

Page({
  data: {
    // "loading" | "new" | "view" | "edit"
    mode: "loading",
    contactId: null,
    contact: null,

    // Form fields
    name: "",
    birthdayMonth: 1,
    birthdayDay: 1,
    birthdayLunar: false,
    birthYear: "",
    gender: "unknown",
    relation: "",
    hometown: "",
    reminderEmail: "",

    // Picker options & indices
    months: MONTHS,
    days: buildDays(1, false),
    monthIndex: 0,
    dayIndex: 0,
    genders: GENDERS,
    genderIndex: 2,
    relations: RELATIONS,
    relationIndex: -1,

    // UI state
    saving: false,
    deleting: false,
    eventsLoading: false,
    eventsGenerated: false,
  },

  // ── 生命周期 ────────────────────────────────────────────────────────────────

  async onLoad(opts) {
    const app = getApp();
    let loggedIn = false;
    if (app && app.globalData.sessionReady) {
      loggedIn = await app.globalData.sessionReady;
    } else {
      loggedIn = isLoggedIn();
    }
    if (!loggedIn) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }

    const id = opts && opts.id;
    if (!id || id === "new") {
      wx.setNavigationBarTitle({ title: "添加生日" });
      this.setData({ mode: "new", days: buildDays(1, false) });
    } else {
      await this.loadContact(parseInt(id, 10));
    }
  },

  // ── 加载联系人 ───────────────────────────────────────────────────────────────

  async loadContact(id) {
    this.setData({ mode: "loading" });
    try {
      const c = await api.get("api/contacts/" + id);
      this._applyContact(c, "view");
      // 若历史大事记为空，自动触发生成
      if (!c.birthdayEvents || c.birthdayEvents.length === 0) {
        this._autoGenerateEvents(id, c.birthdayMonth, c.birthdayDay);
      }
    } catch {
      wx.showToast({ title: "加载失败", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1200);
    }
  },

  // 把服务器数据同步到 data（view 或 edit 模式均用）
  _applyContact(c, mode) {
    const monthIndex = (c.birthdayMonth || 1) - 1;
    const days = buildDays(c.birthdayMonth, c.birthdayLunar);
    const dayIndex = Math.max(0, (c.birthdayDay || 1) - 1);
    const genderIndex = Math.max(0, GENDERS.findIndex(g => g.value === c.gender));
    const relationIndex = RELATIONS.indexOf(c.relation || "");

    this.setData({
      mode: mode || "view",
      contact: c,
      contactId: c.id,
      name: c.name || "",
      birthdayMonth: c.birthdayMonth,
      birthdayDay: c.birthdayDay,
      birthdayLunar: !!c.birthdayLunar,
      birthYear: c.birthYear ? String(c.birthYear) : "",
      gender: c.gender || "unknown",
      relation: c.relation || "",
      hometown: c.hometown || "",
      reminderEmail: c.reminderEmail || "",
      monthIndex,
      days,
      dayIndex,
      genderIndex,
      relationIndex: relationIndex >= 0 ? relationIndex : -1,
    });
    wx.setNavigationBarTitle({ title: c.name || "生日详情" });
  },

  // ── 历史大事记自动生成 ────────────────────────────────────────────────────────

  async _autoGenerateEvents(id, month, day) {
    this.setData({ eventsLoading: true, eventsGenerated: false });
    try {
      // 先等待 1.5s，给服务器后台生成任务一些时间
      await new Promise(r => setTimeout(r, 1500));
      // 重新拉取，看后台是否已完成
      const fresh = await api.get("api/contacts/" + id);
      if (fresh.birthdayEvents && fresh.birthdayEvents.length > 0) {
        this.setData({ "contact.birthdayEvents": fresh.birthdayEvents });
        return;
      }
      // 若仍为空，主动调用生成接口
      const res = await api.post(
        "api/contacts/" + id + "/birthday-events?month=" + month + "&day=" + day,
        {}
      );
      if (res && res.events) {
        this.setData({ "contact.birthdayEvents": res.events });
      }
    } catch { /* 静默失败，用户可手动点"刷新" */ }
    finally {
      this.setData({ eventsLoading: false, eventsGenerated: true });
    }
  },

  // 手动刷新大事记
  async onRefreshEvents() {
    const { contactId, contact } = this.data;
    if (!contactId || this.data.eventsLoading) return;
    this.setData({ eventsLoading: true });
    try {
      const res = await api.post(
        "api/contacts/" + contactId +
        "/birthday-events?month=" + contact.birthdayMonth + "&day=" + contact.birthdayDay,
        {}
      );
      if (res && res.events) {
        this.setData({ "contact.birthdayEvents": res.events });
      }
    } catch {
      wx.showToast({ title: "生成失败，请重试", icon: "none" });
    } finally {
      this.setData({ eventsLoading: false, eventsGenerated: true });
    }
  },

  // ── 模式切换 ─────────────────────────────────────────────────────────────────

  startEdit() {
    this.setData({ mode: "edit" });
    wx.setNavigationBarTitle({ title: "编辑生日" });
  },

  cancelEdit() {
    if (this.data.contactId && this.data.contact) {
      this._applyContact(this.data.contact, "view");
    } else {
      wx.navigateBack();
    }
  },

  // ── 表单输入 ─────────────────────────────────────────────────────────────────

  onNameInput(e) { this.setData({ name: e.detail.value }); },
  onBirthYearInput(e) { this.setData({ birthYear: e.detail.value }); },
  onHometownInput(e) { this.setData({ hometown: e.detail.value }); },
  onEmailInput(e) { this.setData({ reminderEmail: e.detail.value }); },

  onLunarChange(e) {
    const isLunar = e.detail.value;
    const days = buildDays(this.data.birthdayMonth, isLunar);
    const dayIndex = Math.min(this.data.dayIndex, days.length - 1);
    this.setData({
      birthdayLunar: isLunar,
      days,
      dayIndex,
      birthdayDay: days[dayIndex].value,
    });
  },

  // 多列选择器：列值变化时实时更新日期选项
  onBirthdayColumnChange(e) {
    const col = e.detail.column;
    const val = e.detail.value;
    if (col === 0) {
      const month = MONTHS[val].value;
      const days = buildDays(month, this.data.birthdayLunar);
      const dayIndex = Math.min(this.data.dayIndex, days.length - 1);
      this.setData({
        monthIndex: val,
        birthdayMonth: month,
        days,
        dayIndex,
        birthdayDay: days[dayIndex].value,
      });
    } else {
      const days = this.data.days;
      this.setData({
        dayIndex: val,
        birthdayDay: (days[val] || days[days.length - 1]).value,
      });
    }
  },

  onBirthdayChange(e) {
    const [monthIdx, dayIdx] = e.detail.value;
    const month = MONTHS[monthIdx].value;
    const days = buildDays(month, this.data.birthdayLunar);
    const safeIdx = Math.min(dayIdx, days.length - 1);
    this.setData({
      monthIndex: monthIdx,
      birthdayMonth: month,
      days,
      dayIndex: safeIdx,
      birthdayDay: days[safeIdx].value,
    });
  },

  onGenderChange(e) {
    const index = parseInt(e.detail.value, 10);
    this.setData({ genderIndex: index, gender: GENDERS[index].value });
  },

  onRelationChange(e) {
    const index = parseInt(e.detail.value, 10);
    this.setData({ relationIndex: index, relation: RELATIONS[index] });
  },

  // ── 保存 ─────────────────────────────────────────────────────────────────────

  _buildBody() {
    const d = this.data;
    const year = parseInt(d.birthYear, 10);
    const validYear = !isNaN(year) && year >= 1900 && year <= new Date().getFullYear();
    const body = {
      name: d.name.trim(),
      birthdayMonth: d.birthdayMonth,
      birthdayDay: d.birthdayDay,
      birthdayLunar: d.birthdayLunar,
      birthYear: validYear ? year : null,
      relation: d.relation || null,
      hometown: d.hometown.trim() || null,
      reminderEmail: d.reminderEmail.trim() || null,
    };
    // gender API 只接受 "male" / "female"，未知时不发该字段
    if (d.gender === "male" || d.gender === "female") {
      body.gender = d.gender;
    }
    return body;
  },

  _validate() {
    if (!this.data.name.trim()) {
      wx.showToast({ title: "请填写姓名", icon: "none" });
      return false;
    }
    return true;
  },

  async handleSave() {
    if (!this._validate()) return;
    this.setData({ saving: true });
    try {
      const body = this._buildBody();
      if (this.data.contactId) {
        // 更新
        const prevMonth = this.data.contact && this.data.contact.birthdayMonth;
        const prevDay   = this.data.contact && this.data.contact.birthdayDay;
        const updated   = await api.put("api/contacts/" + this.data.contactId, body);
        wx.showToast({ title: "保存成功", icon: "success" });
        this._applyContact(updated, "view");
        const birthdayChanged = updated.birthdayMonth !== prevMonth || updated.birthdayDay !== prevDay;
        const eventsEmpty = !updated.birthdayEvents || updated.birthdayEvents.length === 0;
        if (birthdayChanged || eventsEmpty) {
          this.setData({ "contact.birthdayEvents": [] });
          setTimeout(() => {
            this._autoGenerateEvents(updated.id, updated.birthdayMonth, updated.birthdayDay);
          }, 400);
        }
      } else {
        // 新建
        const created = await api.post("api/contacts", body);
        wx.showToast({ title: "添加成功", icon: "success" });
        // 切换到查看模式（此时大事记还在后台生成中）
        this._applyContact(created, "view");
        // 自动触发生成，完成后展示
        this._autoGenerateEvents(created.id, created.birthdayMonth, created.birthdayDay);
      }
    } catch (err) {
      wx.showToast({ title: (err && err.message) || "保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },

  // ── 删除 ─────────────────────────────────────────────────────────────────────

  handleDelete() {
    const name = (this.data.contact && this.data.contact.name) || "该联系人";
    wx.showModal({
      title: "删除生日",
      content: '确定要删除"' + name + '"吗？',
      confirmText: "删除",
      confirmColor: "#ef4444",
      success: async (res) => {
        if (!res.confirm) return;
        this.setData({ deleting: true });
        try {
          await api.del("api/contacts/" + this.data.contactId);
          wx.showToast({ title: "已删除", icon: "success" });
          setTimeout(() => wx.navigateBack(), 800);
        } catch {
          wx.showToast({ title: "删除失败", icon: "none" });
          this.setData({ deleting: false });
        }
      },
    });
  },

  noop() {},
});
