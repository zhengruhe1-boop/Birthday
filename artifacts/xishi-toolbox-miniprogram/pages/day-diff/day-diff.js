const { track } = require("../../utils/track");
const { ensureLoggedIn } = require("../../utils/auth");

function today() {
  return new Date().toISOString().slice(0, 10);
}

Page({
  data: {
    start: today(),
    end: today(),
    diff: 0,
  },

  onLoad() {
    if (!ensureLoggedIn({ from: "day-diff", redirect: "/pages/day-diff/day-diff" })) return;
    track("page_view", { page: "day-diff" });
    this.calculate();
  },

  changeStart(e) {
    this.setData({ start: e.detail.value }, () => this.calculate());
  },

  changeEnd(e) {
    this.setData({ end: e.detail.value }, () => this.calculate());
  },

  calculate() {
    const start = new Date(`${this.data.start}T00:00:00`).getTime();
    const end = new Date(`${this.data.end}T00:00:00`).getTime();
    const diff = Math.round((end - start) / (24 * 60 * 60 * 1000));
    this.setData({ diff: Math.abs(diff) });
  },
});
