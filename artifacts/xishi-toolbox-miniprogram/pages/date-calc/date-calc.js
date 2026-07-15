const { track } = require("../../utils/track");
const { ensureLoggedIn } = require("../../utils/auth");

Page({
  data: {
    startDate: "",
    intervalDays: "",
    beforeDate: "",
    afterDate: "",
    hasResult1: false,
    endDate: "",
    diffDays: 0,
    hasDiff: false,
  },

  onLoad() {
    if (!ensureLoggedIn({ from: "date-calc", redirect: "/pages/date-calc/date-calc" })) return;
    track("page_view", { page: "date-calc" });
    const today = this._today();
    this.setData({ startDate: today, endDate: today });
  },

  _today() {
    const d = new Date();
    return this._fmt(d);
  },

  _fmt(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  },

  _parseDate(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  },

  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value });
    this._calcFrontBack();
    this._calcDiff();
  },

  onIntervalInput(e) {
    this.setData({ intervalDays: e.detail.value });
    this._calcFrontBack();
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value });
    this._calcDiff();
  },

  _calcFrontBack() {
    const { startDate, intervalDays } = this.data;
    if (!startDate || !intervalDays) {
      this.setData({ hasResult1: false });
      return;
    }
    const n = parseInt(intervalDays, 10);
    if (isNaN(n) || n < 0) {
      this.setData({ hasResult1: false });
      return;
    }
    const ms = n * 86400000;
    const start = this._parseDate(startDate);
    const before = new Date(start.getTime() - ms);
    const after = new Date(start.getTime() + ms);
    this.setData({
      beforeDate: this._fmt(before),
      afterDate: this._fmt(after),
      hasResult1: true,
    });
  },

  _calcDiff() {
    const { startDate, endDate } = this.data;
    if (!startDate || !endDate) {
      this.setData({ hasDiff: false });
      return;
    }
    const start = this._parseDate(startDate);
    const end = this._parseDate(endDate);
    const diff = Math.round((end.getTime() - start.getTime()) / 86400000);
    this.setData({ diffDays: diff, hasDiff: true });
  },

  clearInterval() {
    this.setData({ intervalDays: "", hasResult1: false, beforeDate: "", afterDate: "" });
  },
});
