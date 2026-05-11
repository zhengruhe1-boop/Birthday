Page({
  data: {
    birthDate: '',
    todayStr: '',
    hasResult: false,
    age: 0,
    ageDetail: '',
    xuAge: 0,
    shengXiao: '',
    xingZuo: '',
    wuXing: '',
    benMingNian: false,
    nextBenMingNian: 0,
    birthWeekday: '',
    lifeStage: '',
    totalDays: 0,
    remHours: 0,
    remMinutes: 0,
    remSeconds: 0,
    nextBirthdayDays: 0,
    nextBirthdayWeekday: '',
    age18Days: 0,
    age30Days: 0,
    age50Days: 0,
    age60Days: 0,
    age80Days: 0,
    age100Days: 0,
    copyText: '',
  },

  _timer: null,
  _birth: null,

  onLoad() {
    const d = new Date();
    const todayStr = this._fmt(d);
    const defYear = d.getFullYear() - 25;
    const defBirth = new Date(defYear, d.getMonth(), d.getDate());
    this.setData({ todayStr, birthDate: this._fmt(defBirth) });
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
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  },

  onBirthDateChange(e) {
    this.setData({ birthDate: e.detail.value });
    this._calc();
  },

  _calc() {
    const { birthDate } = this.data;
    if (!birthDate) return;
    const parts = birthDate.split('-').map(Number);
    const by = parts[0], bm = parts[1], bd = parts[2];
    const birth = new Date(by, bm - 1, bd, 0, 0, 0, 0);
    const now = new Date();
    if (birth > now) { this.setData({ hasResult: false }); return; }

    this._birth = birth;

    // 周岁
    let age = now.getFullYear() - by;
    let ageM = now.getMonth() + 1 - bm;
    let ageD = now.getDate() - bd;
    if (ageD < 0) {
      ageM--;
      ageD += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    }
    if (ageM < 0) { age--; ageM += 12; }
    const ageDetail = age + '\u5e74' + ageM + '\u6708' + ageD + '\u5929';

    // 虚岁
    const xuAge = now.getFullYear() - by + 1;

    // 生肖
    const SX = ['\u9f20','\u725b','\u864e','\u5154','\u9f99','\u86c7','\u9a6c','\u7f8a','\u7334','\u9e21','\u72d7','\u732a'];
    const shengXiao = SX[((by - 1900) % 12 + 12) % 12];

    // 星座
    const md = bm * 100 + bd;
    let xingZuo = '';
    if (md >= 1222 || md <= 119) xingZuo = '\u6469\u7faf\u5ea7';
    else if (md <= 218) xingZuo = '\u6c34\u74f6\u5ea7';
    else if (md <= 320) xingZuo = '\u53cc\u9c7c\u5ea7';
    else if (md <= 419) xingZuo = '\u767d\u7f8a\u5ea7';
    else if (md <= 520) xingZuo = '\u91d1\u725b\u5ea7';
    else if (md <= 621) xingZuo = '\u53cc\u5b50\u5ea7';
    else if (md <= 722) xingZuo = '\u5de8\u87f9\u5ea7';
    else if (md <= 822) xingZuo = '\u72ee\u5b50\u5ea7';
    else if (md <= 922) xingZuo = '\u5904\u5973\u5ea7';
    else if (md <= 1023) xingZuo = '\u5929\u79e4\u5ea7';
    else if (md <= 1122) xingZuo = '\u5929\u874e\u5ea7';
    else xingZuo = '\u5c04\u624b\u5ea7';

    // 五行
    const WX = ['\u6728','\u6728','\u706b','\u706b','\u571f','\u571f','\u91d1','\u91d1','\u6c34','\u6c34'];
    const wuXing = WX[((by - 4) % 10 + 10) % 10];

    // 本命年
    const curYear = now.getFullYear();
    const benMingNian = (curYear - by) % 12 === 0;
    let nextBMN = by;
    while (nextBMN <= curYear) nextBMN += 12;
    if (benMingNian) nextBMN = curYear + 12;

    // 出生星期
    const WD = ['\u65e5','\u4e00','\u4e8c','\u4e09','\u56db','\u4e94','\u516d'];
    const birthWeekday = '\u661f\u671f' + WD[birth.getDay()];

    // 人生阶段
    let lifeStage = '';
    if (age < 1) lifeStage = '\u5a74\u513f\u671f';
    else if (age < 3) lifeStage = '\u5e7c\u513f\u671f';
    else if (age < 7) lifeStage = '\u5b66\u9f84\u524d\u671f';
    else if (age < 13) lifeStage = '\u7ae5\u5e74\u671f';
    else if (age < 18) lifeStage = '\u9752\u5c11\u5e74\u671f';
    else if (age < 30) lifeStage = '\u9752\u5e74\u671f';
    else if (age < 45) lifeStage = '\u58ee\u5e74\u671f';
    else if (age < 60) lifeStage = '\u4e2d\u5e74\u671f';
    else if (age < 75) lifeStage = '\u8001\u5e74\u671f';
    else lifeStage = '\u9ad8\u9f84\u671f';

    // 下一生日
    let nextBD = new Date(curYear, bm - 1, bd);
    if (nextBD <= now) nextBD = new Date(curYear + 1, bm - 1, bd);
    const nextBirthdayDays = Math.ceil((nextBD.getTime() - now.getTime()) / 86400000);
    const nextBirthdayWeekday = '\u661f\u671f' + WD[nextBD.getDay()];

    // 里程碑
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
    const fmt = function(n) { return n > 0 ? n + '\u5929' : '\u5df2\u8fc7'; };
    const lines = [
      '\u51fa\u751f\u65e5\u671f\uff1a' + d.birthDate,
      '',
      '\u300a\u57fa\u7840\u4fe1\u606f\u300b',
      '\u5468\u5c81\uff1a' + d.age + '\u5c81\uff08' + d.ageDetail + '\uff09',
      '\u865a\u5c81\uff1a' + d.xuAge + '\u5c81',
      '\u751f\u8096\uff1a' + d.shengXiao,
      '\u661f\u5ea7\uff1a' + d.xingZuo,
      '\u4e94\u884c\uff1a' + d.wuXing,
      '\u672c\u547d\u5e74\uff08\u4eca\u5e74\uff09\uff1a' + (d.benMingNian ? '\u662f' : '\u5426'),
      '\u4e0b\u4e00\u6b21\u672c\u547d\u5e74\uff1a' + d.nextBenMingNian + '\u5e74',
      '\u51fa\u751f\u661f\u671f\uff1a' + d.birthWeekday,
      '\u4eba\u751f\u9636\u6bb5\uff1a' + d.lifeStage,
      '',
      '\u300a\u7cbe\u786e\u65f6\u957f\u300b',
      '\u5df2\u51fa\u751f\uff1a' + d.totalDays + '\u5929',
      '\u5df2\u51fa\u751f\uff1a' + d.remHours + '\u5c0f\u65f6' + d.remMinutes + '\u5206\u949f' + d.remSeconds + '\u79d2',
      '',
      '\u300a\u5176\u4ed6\u4fe1\u606f\u300b',
      '\u4e0b\u4e00\u751f\u65e5\uff1a' + d.nextBirthdayDays + '\u5929\uff08' + d.nextBirthdayWeekday + '\uff09',
      '18\u5c81\u5012\u6570\uff1a' + fmt(d.age18Days),
      '30\u5c81\u5012\u6570\uff1a' + fmt(d.age30Days),
      '50\u5c81\u5012\u6570\uff1a' + fmt(d.age50Days),
      '60\u5c81\u5012\u6570\uff1a' + fmt(d.age60Days),
      '80\u5c81\u5012\u6570\uff1a' + fmt(d.age80Days),
      '100\u5c81\u5012\u6570\uff1a' + fmt(d.age100Days),
    ];
    this.setData({ copyText: lines.join('\n') });
  },

  copyResult() {
    const text = this.data.copyText;
    if (!text) return;
    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({ title: '\u5df2\u590d\u5236', icon: 'success', duration: 1500 });
      },
    });
  },
});
