const { track } = require("../../utils/track");
const { ensureLoggedIn } = require("../../utils/auth");

Page({
  data: {
    birthDate: "",
    todayStr: "",
    hasResult: false,
    age: 0,
    ageDetail: "",
    xuAge: 0,
    shengXiao: "",
    xingZuo: "",
    wuXing: "",
    benMingNian: false,
    nextBenMingNian: 0,
    birthWeekday: "",
    lifeStage: "",
    totalDays: 0,
    remHours: 0,
    remMinutes: 0,
    remSeconds: 0,
    nextBirthdayDays: 0,
    nextBirthdayWeekday: "",
    age18Days: 0,
    age30Days: 0,
    age50Days: 0,
    age60Days: 0,
    age80Days: 0,
    age100Days: 0,
    copyText: "",
  },

  _timer: null,
  _birth: null,

  onLoad() {
    if (!ensureLoggedIn({ from: "age-calc", redirect: "/pages/age-calc/age-calc" })) return;
    track("page_view", { page: "age-calc" });
    const d = new Date();
    this.setData({ todayStr: this._fmt(d) });
  },

  onUnload() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  onHide() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  onShow() {
    if (this._birth && this.data.hasResult) {
      this._startTimer();
    }
  },

  _fmt(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  },

  onBirthDateChange(e) {
    const val = e.detail.value;
    this.setData({ birthDate: val });
    if (this.data.hasResult) {
      this._calc();
    }
  },

  onQuery() {
    if (!this.data.birthDate) {
      wx.showToast({ title: "请选择出生日期", icon: "none" });
      return;
    }
    this._calc();
  },

  _calc() {
    const { birthDate } = this.data;
    if (!birthDate) return;
    const parts = birthDate.split("-").map(Number);
    const by = parts[0], bm = parts[1], bd = parts[2];
    const birth = new Date(by, bm - 1, bd, 0, 0, 0, 0);
    const now = new Date();
    if (birth > now) {
      wx.showToast({ title: "出生日期不能大于今天", icon: "none" });
      return;
    }

    this._birth = birth;

    let age = now.getFullYear() - by;
    let ageM = now.getMonth() + 1 - bm;
    let ageD = now.getDate() - bd;
    if (ageD < 0) {
      ageM--;
      ageD += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    }
    if (ageM < 0) { age--; ageM += 12; }
    const ageDetail = age + "年" + ageM + "月" + ageD + "天";

    const xuAge = now.getFullYear() - by + 1;

    const SX = ["鼠","牛","虎","兔","龙","蛇","马","羊","猴","鸡","狗","猪"];
    const shengXiao = SX[((by - 1900) % 12 + 12) % 12];

    const md = bm * 100 + bd;
    let xingZuo = "";
    if (md >= 1222 || md <= 119) xingZuo = "摩羯座";
    else if (md <= 218) xingZuo = "水瓶座";
    else if (md <= 320) xingZuo = "双鱼座";
    else if (md <= 419) xingZuo = "白羊座";
    else if (md <= 520) xingZuo = "金牛座";
    else if (md <= 621) xingZuo = "双子座";
    else if (md <= 722) xingZuo = "巨蟹座";
    else if (md <= 822) xingZuo = "狮子座";
    else if (md <= 922) xingZuo = "处女座";
    else if (md <= 1023) xingZuo = "天秤座";
    else if (md <= 1122) xingZuo = "天蝎座";
    else xingZuo = "射手座";

    const WX = ["木","木","火","火","土","土","金","金","水","水"];
    const wuXing = WX[((by - 4) % 10 + 10) % 10];

    const curYear = now.getFullYear();
    const benMingNian = (curYear - by) % 12 === 0;
    let nextBMN = by;
    while (nextBMN <= curYear) nextBMN += 12;
    if (benMingNian) nextBMN = curYear + 12;

    const WD = ["日","一","二","三","四","五","六"];
    const birthWeekday = "星期" + WD[birth.getDay()];

    let lifeStage = "";
    if (age < 1) lifeStage = "婴儿期";
    else if (age < 3) lifeStage = "幼儿期";
    else if (age < 7) lifeStage = "学龄前期";
    else if (age < 13) lifeStage = "童年期";
    else if (age < 18) lifeStage = "青少年期";
    else if (age < 30) lifeStage = "青年期";
    else if (age < 45) lifeStage = "壮年期";
    else if (age < 60) lifeStage = "中年期";
    else if (age < 75) lifeStage = "老年期";
    else lifeStage = "高龄期";

    let nextBD = new Date(curYear, bm - 1, bd);
    if (nextBD <= now) nextBD = new Date(curYear + 1, bm - 1, bd);
    const nextBirthdayDays = Math.ceil((nextBD.getTime() - now.getTime()) / 86400000);
    const nextBirthdayWeekday = "星期" + WD[nextBD.getDay()];

    const ms2days = function(targetAge) {
      const t = new Date(by + targetAge, bm - 1, bd);
      return Math.ceil((t.getTime() - now.getTime()) / 86400000);
    };

    this.setData({
      hasResult: true,
      age, ageDetail, xuAge,
      shengXiao, xingZuo, wuXing,
      benMingNian, nextBenMingNian: nextBMN,
      birthWeekday, lifeStage,
      nextBirthdayDays, nextBirthdayWeekday,
      age18Days: ms2days(18),
      age30Days: ms2days(30),
      age50Days: ms2days(50),
      age60Days: ms2days(60),
      age80Days: ms2days(80),
      age100Days: ms2days(100),
    });

    this._startTimer();
  },

  _startTimer() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._tick();
    this._timer = setInterval(this._tick.bind(this), 1000);
  },

  _tick() {
    const birth = this._birth;
    if (!birth) return;
    const now = new Date();
    const ms = now.getTime() - birth.getTime();
    const totalDays = Math.floor(ms / 86400000);
    const remMs = ms - totalDays * 86400000;
    const remHours = Math.floor(remMs / 3600000);
    const remMinutes = Math.floor((remMs - remHours * 3600000) / 60000);
    const remSeconds = Math.floor((remMs - remHours * 3600000 - remMinutes * 60000) / 1000);
    this.setData({ totalDays, remHours, remMinutes, remSeconds });
    this._buildCopy();
  },

  _buildCopy() {
    const d = this.data;
    if (!d.hasResult) return;
    const fmt = function(n) { return n > 0 ? n + "天" : "已过"; };
    const lines = [
      "出生日期：" + d.birthDate,
      "",
      "《基础信息》",
      "周岁：" + d.age + "岁（" + d.ageDetail + "）",
      "虚岁：" + d.xuAge + "岁",
      "生肖：" + d.shengXiao,
      "星座：" + d.xingZuo,
      "五行：" + d.wuXing,
      "本命年（今年）：" + (d.benMingNian ? "是" : "否"),
      "下一次本命年：" + d.nextBenMingNian + "年",
      "出生星期：" + d.birthWeekday,
      "人生阶段：" + d.lifeStage,
      "",
      "《精确时长》",
      "已出生：" + d.totalDays + "天",
      "已出生：" + d.remHours + "小时" + d.remMinutes + "分钟" + d.remSeconds + "秒",
      "",
      "《其他信息》",
      "下一生日：" + d.nextBirthdayDays + "天（" + d.nextBirthdayWeekday + "）",
      "18岁倒数：" + fmt(d.age18Days),
      "30岁倒数：" + fmt(d.age30Days),
      "50岁倒数：" + fmt(d.age50Days),
      "60岁倒数：" + fmt(d.age60Days),
      "80岁倒数：" + fmt(d.age80Days),
      "100岁倒数：" + fmt(d.age100Days),
    ];
    this.setData({ copyText: lines.join("\n") });
  },

  copyResult() {
    const text = this.data.copyText;
    if (!text) return;
    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({ title: "已复制", icon: "success", duration: 1500 });
      },
    });
  },
});
