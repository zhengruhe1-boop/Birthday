const api = require('../../utils/api');

const STORAGE_KEY        = 'fortune_sign';
const BIRTHDAY_KEY       = 'fortune_my_birthday';
const BIRTHDAY_TYPE_KEY  = 'fortune_birthday_type';
const BIRTHDAY_SOLAR_KEY = 'fortune_birthday_solar';   // 独立保存公历生日，切换时可恢复
const BIRTHDAY_LUNAR_KEY = 'fortune_birthday_lunar';
const CACHE_PREFIX       = 'fortune_cache_';

const SIGNS = [
  '白羊座','金牛座','双子座','巨蟹座','狮子座','处女座',
  '天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座',
];

const SIGN_DATA = {
  '白羊座': { emoji:'♈', element:'火象', house:'第一宫（自我宫）', yinyang:'阳性', trait:'勇敢冲动，充满活力', planet:'火星', color:'红色', talisman:'红珊瑚', number:'9', metal:'铁', dateRange:'3/21-4/19' },
  '金牛座': { emoji:'♉', element:'土象', house:'第二宫（财帛宫）', yinyang:'阴性', trait:'稳重踏实，享受生活', planet:'金星', color:'绿色', talisman:'绿松石', number:'6', metal:'铜', dateRange:'4/20-5/20' },
  '双子座': { emoji:'♊', element:'风象', house:'第三宫（传播宫）', yinyang:'阳性', trait:'机智灵活，好奇心强', planet:'水星', color:'黄色', talisman:'玛瑙', number:'5', metal:'汞', dateRange:'5/21-6/21' },
  '巨蟹座': { emoji:'♋', element:'水象', house:'第四宫（家庭宫）', yinyang:'阴性', trait:'温柔敏感，重视家庭', planet:'月亮', color:'银白色', talisman:'珍珠', number:'2', metal:'银', dateRange:'6/22-7/22' },
  '狮子座': { emoji:'♌', element:'火象', house:'第五宫（创意宫）', yinyang:'阳性', trait:'自信大方，魅力十足', planet:'太阳', color:'金色', talisman:'红宝石', number:'1', metal:'金', dateRange:'7/23-8/22' },
  '处女座': { emoji:'♍', element:'土象', house:'第六宫（服务宫）', yinyang:'阴性', trait:'细致认真，追求完美', planet:'水星', color:'灰色', talisman:'蓝宝石', number:'6', metal:'汞', dateRange:'8/23-9/22' },
  '天秤座': { emoji:'♎', element:'风象', house:'第七宫（婚姻宫）', yinyang:'阳性', trait:'温和优雅，追求平衡', planet:'金星', color:'粉色', talisman:'白玉', number:'6', metal:'铜', dateRange:'9/23-10/23' },
  '天蝎座': { emoji:'♏', element:'水象', house:'第八宫（死亡宫）', yinyang:'阴性', trait:'神秘深沉，意志坚定', planet:'冥王星', color:'深红色', talisman:'黑曜石', number:'9', metal:'铁', dateRange:'10/24-11/22' },
  '射手座': { emoji:'♐', element:'火象', house:'第九宫（哲学宫）', yinyang:'阳性', trait:'乐观自由，热爱冒险', planet:'木星', color:'紫色', talisman:'紫水晶', number:'3', metal:'锡', dateRange:'11/23-12/21' },
  '摩羯座': { emoji:'♑', element:'土象', house:'第十宫（事业宫）', yinyang:'阴性', trait:'踏实勤奋，目标坚定', planet:'土星', color:'黑色', talisman:'黑玛瑙', number:'8', metal:'鉛', dateRange:'12/22-1/19' },
  '水瓶座': { emoji:'♒', element:'风象', house:'第十一宫（友谊宫）', yinyang:'阳性', trait:'独立创新，思想超前', planet:'天王星', color:'蓝色', talisman:'蓝宝石', number:'4', metal:'铀', dateRange:'1/20-2/18' },
  '双鱼座': { emoji:'♓', element:'水象', house:'第十二宫（隐居宫）', yinyang:'阴性', trait:'感性浪漫，富有同情心', planet:'海王星', color:'海蓝色', talisman:'海蓝宝石', number:'7', metal:'锡', dateRange:'2/19-3/20' },
};

function getSignFromMonthDay(month, day) {
  const m = parseInt(month, 10);
  const d = parseInt(day,   10);
  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return '白羊座';
  if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return '金牛座';
  if ((m === 5 && d >= 21) || (m === 6 && d <= 21)) return '双子座';
  if ((m === 6 && d >= 22) || (m === 7 && d <= 22)) return '巨蟹座';
  if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return '狮子座';
  if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return '处女座';
  if ((m === 9 && d >= 23) || (m === 10 && d <= 23)) return '天秤座';
  if ((m === 10 && d >= 24) || (m === 11 && d <= 22)) return '天蝎座';
  if ((m === 11 && d >= 23) || (m === 12 && d <= 21)) return '射手座';
  if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return '摩羯座';
  if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return '水瓶座';
  return '双鱼座';
}

function signFromDateStr(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 2) return '';
  const month = parts[parts.length - 2];
  const day   = parts[parts.length - 1];
  return getSignFromMonthDay(month, day);
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function padTwo(n) { return String(n).padStart(2, '0'); }

function buildIndices(fortune) {
  return [
    { key: 'love',   name: '爱情', emoji: '💕', score: fortune.love?.score   || 0, desc: fortune.love?.desc   || '', color: '#f43f5e' },
    { key: 'career', name: '事业', emoji: '💼', score: fortune.career?.score || 0, desc: fortune.career?.desc || '', color: '#3b82f6' },
    { key: 'wealth', name: '财运', emoji: '💰', score: fortune.wealth?.score || 0, desc: fortune.wealth?.desc || '', color: '#f59e0b' },
    { key: 'health', name: '健康', emoji: '🌿', score: fortune.health?.score || 0, desc: fortune.health?.desc || '', color: '#10b981' },
  ];
}

// ── 农历支持 ──────────────────────────────────────────────────────────────────

const LUNAR_MONTHS_DISPLAY = [
  '正月','二月','三月','四月','五月','六月',
  '七月','八月','九月','十月','十一月','腊月',
];

const LUNAR_DAYS_DISPLAY = [
  '初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
  '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十',
];

// 春节公历日期 [月, 日]，用于农历→公历换算
const SPRING_FESTIVAL = {
  1930:[1,30],1931:[2,17],1932:[2,6], 1933:[1,26],1934:[2,14],
  1935:[2,4], 1936:[1,24],1937:[2,11],1938:[1,31],1939:[2,19],
  1940:[2,8], 1941:[1,27],1942:[2,15],1943:[2,5], 1944:[1,25],
  1945:[2,13],1946:[2,2], 1947:[1,22],1948:[2,10],1949:[1,29],
  1950:[2,17],1951:[2,6], 1952:[1,27],1953:[2,14],1954:[2,3],
  1955:[1,24],1956:[2,12],1957:[1,31],1958:[2,18],1959:[2,8],
  1960:[1,28],1961:[2,15],1962:[2,5], 1963:[1,25],1964:[2,13],
  1965:[2,2], 1966:[1,21],1967:[2,9], 1968:[1,30],1969:[2,17],
  1970:[2,6], 1971:[1,27],1972:[2,15],1973:[2,3], 1974:[1,23],
  1975:[2,11],1976:[1,31],1977:[2,18],1978:[2,7], 1979:[1,28],
  1980:[2,16],1981:[2,5], 1982:[1,25],1983:[2,13],1984:[2,2],
  1985:[2,20],1986:[2,9], 1987:[1,29],1988:[2,17],1989:[2,6],
  1990:[1,27],1991:[2,15],1992:[2,4], 1993:[1,23],1994:[2,10],
  1995:[1,31],1996:[2,19],1997:[2,7], 1998:[1,28],1999:[2,16],
  2000:[2,5], 2001:[1,24],2002:[2,12],2003:[2,1], 2004:[1,22],
  2005:[2,9], 2006:[1,29],2007:[2,18],2008:[2,7], 2009:[1,26],
  2010:[2,14],2011:[2,3], 2012:[1,23],2013:[2,10],2014:[1,31],
  2015:[2,19],2016:[2,8], 2017:[1,28],2018:[2,16],2019:[2,5],
  2020:[1,25],2021:[2,12],2022:[2,1], 2023:[1,22],2024:[2,10],
  2025:[1,29],2026:[2,17],2027:[2,6], 2028:[1,26],2029:[2,13],
  2030:[2,3],
};

// 各年闰月数据 [闰月月份, 闰月天数]，无闰月的年份不收录
// 数据来源：中国农历历法记录 1930-2030
const LEAP_MONTHS = {
  1930:[6,29], 1933:[5,29], 1936:[3,30], 1938:[7,29],
  1941:[6,29], 1944:[4,29], 1947:[2,29], 1949:[7,29],
  1952:[5,29], 1955:[3,29], 1957:[8,29], 1960:[6,29],
  1963:[4,29], 1966:[3,29], 1968:[7,29], 1971:[5,29],
  1974:[4,29], 1976:[8,29], 1979:[6,29], 1982:[4,29],
  1984:[10,29],1987:[6,29], 1990:[5,29], 1993:[3,29],
  1995:[8,29], 1998:[5,29], 2001:[4,29], 2004:[2,29],
  2006:[7,29], 2009:[5,29], 2012:[4,30], 2014:[9,29],
  2017:[6,29], 2020:[4,29], 2023:[2,29], 2025:[6,30],
  2028:[5,29],
};

// 农历→公历换算，正确处理闰月
// 原理：以春节（正月初一）为起点，累加各月天数至目标月，
//       若闰月落在目标月之前则额外加上闰月天数。
function lunarToSolar(lunarYear, lunarMonth, lunarDay) {
  const sf = SPRING_FESTIVAL[lunarYear];
  if (!sf) return null;
  const springDate = new Date(lunarYear, sf[0] - 1, sf[1]);

  // 正月初一到目标月初一的天数（月均近似 29.53 天）
  let offsetDays = Math.round((lunarMonth - 1) * 29.53);

  // 若本年有闰月且闰月在目标月之前，需加上闰月的天数
  const leap = LEAP_MONTHS[lunarYear];
  if (leap && leap[0] > 0 && leap[0] < lunarMonth) {
    offsetDays += leap[1];
  }

  // 加上月内日数（从初一算起）
  offsetDays += lunarDay - 1;

  const solarDate = new Date(springDate.getTime() + offsetDays * 86400000);
  return {
    year:  solarDate.getFullYear(),
    month: solarDate.getMonth() + 1,
    day:   solarDate.getDate(),
  };
}

function buildLunarYears() {
  const endYear = new Date().getFullYear();
  const list = [], values = [];
  for (let y = endYear; y >= 1930; y--) {
    list.push(y + '年');
    values.push(y);
  }
  return { list, values };
}

// ── Page ──────────────────────────────────────────────────────────────────────

Page({
  data: {
    signData: SIGN_DATA,
    currentSign: '',
    myBirthday: '',
    queryDate: todayStr(),
    fortune: null,
    indices: [],
    loading: false,
    error: '',

    calType: 'solar',
    solarBirthday: '',

    lunarPickerRange: [[], LUNAR_MONTHS_DISPLAY, LUNAR_DAYS_DISPLAY],
    lunarPickerValue: [0, 0, 0],
    lunarBirthdayDisplay: '',
    lunarYearValues: [],
  },

  onLoad(opts) {
    const yearData     = buildLunarYears();
    const savedType    = wx.getStorageSync(BIRTHDAY_TYPE_KEY) || 'solar';
    const savedBirthday = wx.getStorageSync(BIRTHDAY_KEY) || '';
    const savedLunar   = wx.getStorageSync(BIRTHDAY_LUNAR_KEY) || '';
    const savedSign    = wx.getStorageSync(STORAGE_KEY) || '';

    let sign = '';
    if (savedBirthday) {
      sign = signFromDateStr(savedBirthday);
    } else if (opts.sign) {
      sign = opts.sign;
    } else if (savedSign) {
      sign = savedSign;
    }

    // 默认年份：当前年份往前36年（常见用户年龄）
    const defaultYear    = new Date().getFullYear() - 36;
    const defaultYearIdx = Math.max(0, yearData.values.indexOf(defaultYear));

    let lunarPickerValue    = [defaultYearIdx, 0, 0];
    let lunarBirthdayDisplay = '';

    if (savedType === 'lunar' && savedLunar) {
      const parts = savedLunar.split('-');
      if (parts.length === 3) {
        const ly   = parseInt(parts[0]);
        const lm   = parseInt(parts[1]);
        const ld   = parseInt(parts[2]);
        const yIdx = yearData.values.indexOf(ly);
        if (yIdx >= 0) {
          lunarPickerValue     = [yIdx, lm - 1, ld - 1];
          lunarBirthdayDisplay = `农历 ${ly}年 ${LUNAR_MONTHS_DISPLAY[lm - 1]} ${LUNAR_DAYS_DISPLAY[ld - 1]}`;
        }
      }
    }

    // 公历生日从独立 key 恢复，无论当前是哪种历法
    const savedSolar = wx.getStorageSync(BIRTHDAY_SOLAR_KEY) || (savedType === 'solar' ? savedBirthday : '');

    this.setData({
      calType: savedType,
      solarBirthday: savedSolar,
      myBirthday: savedBirthday,
      currentSign: sign,
      queryDate: todayStr(),
      lunarPickerRange: [yearData.list, LUNAR_MONTHS_DISPLAY, LUNAR_DAYS_DISPLAY],
      lunarPickerValue,
      lunarBirthdayDisplay,
      lunarYearValues: yearData.values,
    });

    if (sign) {
      wx.setStorageSync(STORAGE_KEY, sign);
      this._loadWithFallback(sign, this.data.queryDate);
    }
  },

  onShow() {
    const savedBirthday = wx.getStorageSync(BIRTHDAY_KEY) || '';
    if (savedBirthday !== this.data.myBirthday) {
      const sign = signFromDateStr(savedBirthday);
      wx.setStorageSync(STORAGE_KEY, sign);
      this.setData({ myBirthday: savedBirthday, currentSign: sign, fortune: null, indices: [], error: '' });
      if (sign) this._loadWithFallback(sign, this.data.queryDate);
    }
  },

  // ── 公历/农历 切换 ──────────────────────────────────────────────────────────
  onCalTypeSolar() {
    if (this.data.calType === 'solar') return;
    wx.setStorageSync(BIRTHDAY_TYPE_KEY, 'solar');
    // 从独立 key 恢复公历生日（不依赖内存 state，state 在切换农历时已被清空）
    const savedSolar = wx.getStorageSync(BIRTHDAY_SOLAR_KEY) || '';
    const newSign    = savedSolar ? signFromDateStr(savedSolar) : '';
    const signChanged = newSign !== this.data.currentSign;
    const update = {
      calType: 'solar',
      solarBirthday: savedSolar,
      myBirthday: savedSolar,
      currentSign: newSign,
    };
    // 星座发生变化才清空运势，否则保留当前运势内容
    if (signChanged) {
      update.fortune = null;
      update.indices = [];
      update.error   = '';
    }
    this.setData(update);
    if (savedSolar) wx.setStorageSync(BIRTHDAY_KEY, savedSolar);
    if (newSign) {
      wx.setStorageSync(STORAGE_KEY, newSign);
      if (signChanged) this._loadWithFallback(newSign, this.data.queryDate);
    }
  },

  onCalTypeLunar() {
    if (this.data.calType === 'lunar') return;
    wx.setStorageSync(BIRTHDAY_TYPE_KEY, 'lunar');
    // 从独立 key 恢复农历生日
    const savedLunar = wx.getStorageSync(BIRTHDAY_LUNAR_KEY) || '';
    let display = '', myBirthday = '', newSign = '';
    if (savedLunar) {
      const parts = savedLunar.split('-');
      if (parts.length === 3) {
        const ly = parseInt(parts[0]);
        const lm = parseInt(parts[1]);
        const ld = parseInt(parts[2]);
        display  = `农历 ${ly}年 ${LUNAR_MONTHS_DISPLAY[lm - 1]} ${LUNAR_DAYS_DISPLAY[ld - 1]}`;
        const solar = lunarToSolar(ly, lm, ld);
        if (solar) {
          myBirthday = `${solar.year}-${padTwo(solar.month)}-${padTwo(solar.day)}`;
          newSign    = getSignFromMonthDay(solar.month, solar.day);
        }
      }
    }
    const signChanged = newSign !== this.data.currentSign;
    const update = {
      calType: 'lunar',
      solarBirthday: '',
      lunarBirthdayDisplay: display,
      myBirthday,
      currentSign: newSign,
    };
    if (signChanged) {
      update.fortune = null;
      update.indices = [];
      update.error   = '';
    }
    this.setData(update);
    if (myBirthday) wx.setStorageSync(BIRTHDAY_KEY, myBirthday);
    if (newSign) {
      wx.setStorageSync(STORAGE_KEY, newSign);
      if (signChanged) this._loadWithFallback(newSign, this.data.queryDate);
    }
  },

  // ── 公历生日选择 ────────────────────────────────────────────────────────────
  onSolarBirthdayChange(e) {
    const birthday = e.detail.value;
    const sign     = signFromDateStr(birthday);
    wx.setStorageSync(BIRTHDAY_KEY,       birthday);
    wx.setStorageSync(BIRTHDAY_SOLAR_KEY, birthday); // 独立持久化，切换时可恢复
    wx.setStorageSync(STORAGE_KEY,        sign);
    this.setData({
      solarBirthday: birthday,
      myBirthday: birthday,
      currentSign: sign,
      fortune: null,
      indices: [],
      error: '',
    });
    if (sign) this._loadWithFallback(sign, this.data.queryDate);
  },

  // ── 农历生日选择 ────────────────────────────────────────────────────────────
  onLunarBirthdayChange(e) {
    const idxArr     = e.detail.value;           // [yearIdx, monthIdx, dayIdx]
    const yearValues = this.data.lunarYearValues;
    const ly = yearValues[idxArr[0]];
    const lm = idxArr[1] + 1;                    // 1-12
    const ld = idxArr[2] + 1;                    // 1-30

    const solar = lunarToSolar(ly, lm, ld);
    if (!solar) {
      wx.showToast({ title: '日期转换失败', icon: 'none' });
      return;
    }

    const solarStr  = `${solar.year}-${padTwo(solar.month)}-${padTwo(solar.day)}`;
    const sign      = getSignFromMonthDay(solar.month, solar.day);
    const display   = `农历 ${ly}年 ${LUNAR_MONTHS_DISPLAY[lm - 1]} ${LUNAR_DAYS_DISPLAY[ld - 1]}`;
    const lunarRaw  = `${ly}-${lm}-${ld}`;

    wx.setStorageSync(BIRTHDAY_KEY,       solarStr);
    wx.setStorageSync(BIRTHDAY_LUNAR_KEY, lunarRaw);
    wx.setStorageSync(STORAGE_KEY,        sign);

    this.setData({
      lunarPickerValue:     [idxArr[0], idxArr[1], idxArr[2]],
      lunarBirthdayDisplay: display,
      myBirthday:           solarStr,
      currentSign:          sign,
      fortune:              null,
      indices:              [],
      error:                '',
    });
    if (sign) this._loadWithFallback(sign, this.data.queryDate);
  },

  // ── 查询日期选择 ────────────────────────────────────────────────────────────
  onDateChange(e) {
    const date = e.detail.value;
    this.setData({ queryDate: date, fortune: null, indices: [], error: '' });
    if (this.data.currentSign) {
      this._loadWithFallback(this.data.currentSign, date);
    }
  },

  // ── 缓存 / 加载 ─────────────────────────────────────────────────────────────
  _cacheKey(sign, date) {
    return CACHE_PREFIX + sign + '_' + date;
  },

  _loadWithFallback(sign, date) {
    try {
      const cached = wx.getStorageSync(this._cacheKey(sign, date));
      if (cached && cached.fortune) {
        this.setData({ fortune: cached.fortune, indices: buildIndices(cached.fortune), error: '' });
        return;
      }
    } catch {}
    this._fetchServerCache(sign, date);
  },

  _fetchServerCache(sign, date) {
    const self = this;
    api.get('api/fortune/' + encodeURIComponent(sign) + '/' + date)
      .then(function(res) {
        if (res && res.fortune) {
          wx.setStorageSync(self._cacheKey(sign, date), { fortune: res.fortune, cachedAt: Date.now() });
          self.setData({ fortune: res.fortune, indices: buildIndices(res.fortune), error: '' });
        } else {
          self._autoGenerate(sign, date);
        }
      })
      .catch(function() {
        self._autoGenerate(sign, date);
      });
  },

  _autoGenerate(sign, date) {
    const self = this;
    if (self.data.loading) return;
    self.setData({ loading: true, error: '' });
    api.post('api/fortune', { sign, date })
      .then(function(res) {
        const fortune = res.fortune;
        wx.setStorageSync(self._cacheKey(sign, date), { fortune, cachedAt: Date.now() });
        self.setData({ fortune, indices: buildIndices(fortune), loading: false });
      })
      .catch(function(err) {
        self.setData({ loading: false, error: err.message || '获取运势失败，请稍后重试' });
      });
  },

  // ── 生成按钮 ────────────────────────────────────────────────────────────────
  async queryFortune() {
    const { currentSign, queryDate, loading } = this.data;
    if (loading) return;
    if (!currentSign) {
      wx.showToast({ title: '请先设置您的生日', icon: 'none' });
      return;
    }

    const cacheKey = this._cacheKey(currentSign, queryDate);
    try {
      const cached = wx.getStorageSync(cacheKey);
      if (cached && cached.fortune) {
        this.setData({ fortune: cached.fortune, indices: buildIndices(cached.fortune), error: '' });
        wx.showToast({ title: '已生成运势', icon: 'none', duration: 1500 });
        return;
      }
    } catch {}

    this.setData({ loading: true, error: '', fortune: null, indices: [] });

    try {
      const serverRes = await api.get('api/fortune/' + encodeURIComponent(currentSign) + '/' + queryDate);
      if (serverRes && serverRes.fortune) {
        wx.setStorageSync(cacheKey, { fortune: serverRes.fortune, cachedAt: Date.now() });
        this.setData({ fortune: serverRes.fortune, indices: buildIndices(serverRes.fortune), loading: false });
        wx.showToast({ title: '已生成运势', icon: 'none', duration: 1500 });
        return;
      }
    } catch {}

    try {
      const res     = await api.post('api/fortune', { sign: currentSign, date: queryDate });
      const fortune = res.fortune;
      wx.setStorageSync(cacheKey, { fortune, cachedAt: Date.now() });
      this.setData({ fortune, indices: buildIndices(fortune), loading: false });
      wx.showToast({ title: '已生成运势', icon: 'none', duration: 1500 });
    } catch (err) {
      this.setData({ loading: false, error: err.message || '获取运势失败，请稍后重试' });
    }
  },
});
