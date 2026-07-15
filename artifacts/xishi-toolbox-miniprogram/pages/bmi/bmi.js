const { track } = require("../../utils/track");
const { ensureLoggedIn } = require("../../utils/auth");

Page({
  data: {
    height: "170",
    weight: "65",
    bmi: "22.5",
    level: "正常",
  },

  onLoad() {
    if (!ensureLoggedIn({ from: "bmi", redirect: "/pages/bmi/bmi" })) return;
    track("page_view", { page: "bmi" });
    this.calculate();
  },

  changeHeight(e) {
    this.setData({ height: e.detail.value }, () => this.calculate());
  },

  changeWeight(e) {
    this.setData({ weight: e.detail.value }, () => this.calculate());
  },

  calculate() {
    const height = Number(this.data.height) / 100;
    const weight = Number(this.data.weight);
    if (!height || !weight || Number.isNaN(height) || Number.isNaN(weight)) {
      this.setData({ bmi: "--", level: "请输入有效数值" });
      return;
    }

    const bmiNum = weight / (height * height);
    let level = "正常";
    if (bmiNum < 18.5) level = "偏瘦";
    else if (bmiNum < 24) level = "正常";
    else if (bmiNum < 28) level = "超重";
    else level = "肥胖";

    this.setData({ bmi: bmiNum.toFixed(1), level });
  },
});
