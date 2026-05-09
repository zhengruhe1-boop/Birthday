const api = require('../../utils/api');

const STORAGE_KEY = 'fortune_sign';
const CACHE_PREFIX = 'fortune_cache_';

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
  '摩羯座': { emoji:'♑', element:'土象', house:'第十宫（事业宫）', yinyang:'阴性', trait:'踏实勤奋，目标坚定', planet:'土星', color:'黑色', talisman:'黑玛瑙', number:'8', metal:'铅', dateRange:'12/22-1/19' },
  '水瓶座': { emoji:'♒', element:'风象', house:'第十一宫（友谊宫）', yinyang:'阳性', trait:'独立创新，思想超前', planet:'天王星', color:'蓝色', talisman:'蓝宝石', number:'4', metal:'铀', dateRange:'1/20-2/18' },
  '双鱼座': { emoji:'♓', element:'水象', house:'第十二宫（隐居宫）', yinyang:'阴性', trait:'感性浪漫，富有同情心', planet:'海王星', color:'海蓝色', talisman:'海蓝宝石', number:'7', metal:'锡', dateRange:'2/19-3/20' },
};

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildIndices(fortune) {
  return [
    { key: 'love',   name: '爱情', emoji: '💕', score: fortune.love?.score   || 0, desc: fortune.love?.desc   || '', color: '#f43f5e' },
    { key: 'career', name: '事业', emoji: '💼', score: fortune.career?.score || 0, desc: fortune.career?.desc || '', color: '#3b82f6' },
    { key: 'wealth', name: '财运', emoji: '💰', score: fortune.wealth?.score || 0, desc: fortune.wealth?.desc || '', color: '#f59e0b' },
    { key: 'health', name: '健康', emoji: '🌿', score: fortune.health?.score || 0, desc: fortune.health?.desc || '', color: '#10b981' },
  ];
}

Page({
  data: {
    signs: SIGNS,
    signData: SIGN_DATA,
    currentSign: '',
    queryDate: todayStr(),
    fortune: null,
    indices: [],
    loading: false,
    error: '',
    showSignPicker: false,
  },

  onLoad(opts) {
    const savedSign = wx.getStorageSync(STORAGE_KEY) || '';
    const sign = opts.sign || savedSign;
    this.setData({ currentSign: sign, queryDate: todayStr() });

    if (sign) {
      this._loadCached(sign, this.data.queryDate);
    }
  },

  onShow() {
    const saved = wx.getStorageSync(STORAGE_KEY) || '';
    if (saved && saved !== this.data.currentSign) {
      this.setData({ currentSign: saved, fortune: null, indices: [], error: '' });
    }
  },

  _cacheKey(sign, date) {
    return CACHE_PREFIX + sign + '_' + date;
  },

  _loadCached(sign, date) {
    try {
      const cached = wx.getStorageSync(this._cacheKey(sign, date));
      if (cached && cached.fortune) {
        this.setData({
          fortune: cached.fortune,
          indices: buildIndices(cached.fortune),
          error: '',
        });
      }
    } catch {}
  },

  openSignPicker() {
    this.setData({ showSignPicker: true });
  },

  closeSignPicker() {
    this.setData({ showSignPicker: false });
  },

  noop() {},

  selectSign(e) {
    const sign = e.currentTarget.dataset.sign;
    wx.setStorageSync(STORAGE_KEY, sign);
    this.setData({
      currentSign: sign,
      showSignPicker: false,
      fortune: null,
      indices: [],
      error: '',
    });
    this._loadCached(sign, this.data.queryDate);
  },

  onDateChange(e) {
    const date = e.detail.value;
    this.setData({ queryDate: date, fortune: null, indices: [], error: '' });
    if (this.data.currentSign) {
      this._loadCached(this.data.currentSign, date);
    }
  },

  async queryFortune() {
    const { currentSign, queryDate, loading } = this.data;
    if (loading) return;
    if (!currentSign) {
      wx.showToast({ title: '请先选择星座', icon: 'none' });
      return;
    }

    const cacheKey = this._cacheKey(currentSign, queryDate);
    try {
      const cached = wx.getStorageSync(cacheKey);
      if (cached && cached.fortune) {
        this.setData({
          fortune: cached.fortune,
          indices: buildIndices(cached.fortune),
          error: '',
        });
        wx.showToast({ title: '已加载缓存运势', icon: 'none', duration: 1500 });
        return;
      }
    } catch {}

    this.setData({ loading: true, error: '', fortune: null, indices: [] });
    try {
      const res = await api.post('api/fortune', { sign: currentSign, date: queryDate });
      const fortune = res.fortune;
      wx.setStorageSync(cacheKey, { fortune, cachedAt: Date.now() });
      wx.setStorageSync(STORAGE_KEY, currentSign);
      this.setData({
        fortune,
        indices: buildIndices(fortune),
        loading: false,
      });
    } catch (err) {
      this.setData({
        loading: false,
        error: err.message || '获取运势失败，请稍后重试',
      });
    }
  },
});
