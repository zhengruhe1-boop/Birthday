const api = require('../../utils/api');

const STORAGE_KEY = 'fortune_sign';
const CACHE_PREFIX = 'fortune_cache_';

const SIGNS = [
  '\u767d\u7f8a\u5ea7','\u91d1\u725b\u5ea7','\u53cc\u5b50\u5ea7','\u5de8\u87f9\u5ea7','\u72ee\u5b50\u5ea7','\u5904\u5973\u5ea7',
  '\u5929\u79e4\u5ea7','\u5929\u874e\u5ea7','\u5c04\u624b\u5ea7','\u6469\u7faf\u5ea7','\u6c34\u74f6\u5ea7','\u53cc\u9c7c\u5ea7',
];

const SIGN_DATA = {
  '\u767d\u7f8a\u5ea7': { emoji:'\u2648', element:'\u706b\u8c61', house:'\u7b2c\u4e00\u5bab\uff08\u81ea\u6211\u5bab\uff09', yinyang:'\u9633\u6027', trait:'\u52c7\u655a\u51b2\u52a8\uff0c\u5145\u6ee1\u6d3b\u529b', planet:'\u706b\u661f', color:'\u7ea2\u8272', talisman:'\u7ea2\u73ca\u745a', number:'9', metal:'\u94c1', dateRange:'3/21-4/19' },
  '\u91d1\u725b\u5ea7': { emoji:'\u2649', element:'\u571f\u8c61', house:'\u7b2c\u4e8c\u5bab\uff08\u8d22\u5e1b\u5bab\uff09', yinyang:'\u9634\u6027', trait:'\u7a33\u91cd\u8e0f\u5b9e\uff0c\u4eab\u53d7\u751f\u6d3b', planet:'\u91d1\u661f', color:'\u7eff\u8272', talisman:'\u7eff\u677e\u77f3', number:'6', metal:'\u94dc', dateRange:'4/20-5/20' },
  '\u53cc\u5b50\u5ea7': { emoji:'\u264a', element:'\u98ce\u8c61', house:'\u7b2c\u4e09\u5bab\uff08\u4f20\u64ad\u5bab\uff09', yinyang:'\u9633\u6027', trait:'\u673a\u667a\u7075\u6d3b\uff0c\u597d\u5947\u5fc3\u5f3a', planet:'\u6c34\u661f', color:'\u9ec4\u8272', talisman:'\u739b\u7459', number:'5', metal:'\u6c5e', dateRange:'5/21-6/21' },
  '\u5de8\u87f9\u5ea7': { emoji:'\u264b', element:'\u6c34\u8c61', house:'\u7b2c\u56db\u5bab\uff08\u5bb6\u5ead\u5bab\uff09', yinyang:'\u9634\u6027', trait:'\u6e29\u67d4\u654f\u611f\uff0c\u91cd\u89c6\u5bb6\u5ead', planet:'\u6708\u4eae', color:'\u94f6\u767d\u8272', talisman:'\u73cd\u73e0', number:'2', metal:'\u94f6', dateRange:'6/22-7/22' },
  '\u72ee\u5b50\u5ea7': { emoji:'\u264c', element:'\u706b\u8c61', house:'\u7b2c\u4e94\u5bab\uff08\u521b\u610f\u5bab\uff09', yinyang:'\u9633\u6027', trait:'\u81ea\u4fe1\u5927\u65b9\uff0c\u9b45\u529b\u5341\u8db3', planet:'\u592a\u9633', color:'\u91d1\u8272', talisman:'\u7ea2\u5b9d\u77f3', number:'1', metal:'\u91d1', dateRange:'7/23-8/22' },
  '\u5904\u5973\u5ea7': { emoji:'\u264d', element:'\u571f\u8c61', house:'\u7b2c\u516d\u5bab\uff08\u670d\u52a1\u5bab\uff09', yinyang:'\u9634\u6027', trait:'\u7ec6\u81f4\u8ba4\u771f\uff0c\u8ffd\u6c42\u5b8c\u7f8e', planet:'\u6c34\u661f', color:'\u7070\u8272', talisman:'\u84dd\u5b9d\u77f3', number:'6', metal:'\u6c5e', dateRange:'8/23-9/22' },
  '\u5929\u79e4\u5ea7': { emoji:'\u264e', element:'\u98ce\u8c61', house:'\u7b2c\u4e03\u5bab\uff08\u5a5a\u59fb\u5bab\uff09', yinyang:'\u9633\u6027', trait:'\u6e29\u548c\u4f18\u96c5\uff0c\u8ffd\u6c42\u5e73\u8861', planet:'\u91d1\u661f', color:'\u7c89\u8272', talisman:'\u767d\u7389', number:'6', metal:'\u94dc', dateRange:'9/23-10/23' },
  '\u5929\u874e\u5ea7': { emoji:'\u264f', element:'\u6c34\u8c61', house:'\u7b2c\u516b\u5bab\uff08\u6b7b\u4ea1\u5bab\uff09', yinyang:'\u9634\u6027', trait:'\u795e\u79d8\u6df1\u6c89\uff0c\u610f\u5fd7\u575a\u5b9a', planet:'\u51a5\u738b\u661f', color:'\u6df1\u7ea2\u8272', talisman:'\u9ed1\u66dc\u77f3', number:'9', metal:'\u94c1', dateRange:'10/24-11/22' },
  '\u5c04\u624b\u5ea7': { emoji:'\u2650', element:'\u706b\u8c61', house:'\u7b2c\u4e5d\u5bab\uff08\u54f2\u5b66\u5bab\uff09', yinyang:'\u9633\u6027', trait:'\u4e50\u89c2\u81ea\u7531\uff0c\u70ed\u7231\u5192\u9669', planet:'\u6728\u661f', color:'\u7d2b\u8272', talisman:'\u7d2b\u6c34\u6676', number:'3', metal:'\u9521', dateRange:'11/23-12/21' },
  '\u6469\u7faf\u5ea7': { emoji:'\u2651', element:'\u571f\u8c61', house:'\u7b2c\u5341\u5bab\uff08\u4e8b\u4e1a\u5bab\uff09', yinyang:'\u9634\u6027', trait:'\u8e0f\u5b9e\u52e4\u594b\uff0c\u76ee\u6807\u575a\u5b9a', planet:'\u571f\u661f', color:'\u9ed1\u8272', talisman:'\u9ed1\u739b\u7459', number:'8', metal:'\u9c9b', dateRange:'12/22-1/19' },
  '\u6c34\u74f6\u5ea7': { emoji:'\u2652', element:'\u98ce\u8c61', house:'\u7b2c\u5341\u4e00\u5bab\uff08\u53cb\u8c0a\u5bab\uff09', yinyang:'\u9633\u6027', trait:'\u72ec\u7acb\u521b\u65b0\uff0c\u601d\u60f3\u8d85\u524d', planet:'\u5929\u738b\u661f', color:'\u84dd\u8272', talisman:'\u84dd\u5b9d\u77f3', number:'4', metal:'\u94c0', dateRange:'1/20-2/18' },
  '\u53cc\u9c7c\u5ea7': { emoji:'\u2653', element:'\u6c34\u8c61', house:'\u7b2c\u5341\u4e8c\u5bab\uff08\u9690\u5c45\u5bab\uff09', yinyang:'\u9634\u6027', trait:'\u611f\u6027\u6d6a\u6f2b\uff0c\u5bcc\u6709\u540c\u60c5\u5fc3', planet:'\u6d77\u738b\u661f', color:'\u6d77\u84dd\u8272', talisman:'\u6d77\u84dd\u5b9d\u77f3', number:'7', metal:'\u9521', dateRange:'2/19-3/20' },
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
    { key: 'love',   name: '\u7231\u60c5', emoji: '\ud83d\udc95', score: fortune.love?.score   || 0, desc: fortune.love?.desc   || '', color: '#f43f5e' },
    { key: 'career', name: '\u4e8b\u4e1a', emoji: '\ud83d\udcbc', score: fortune.career?.score || 0, desc: fortune.career?.desc || '', color: '#3b82f6' },
    { key: 'wealth', name: '\u8d22\u8fd0', emoji: '\ud83d\udcb0', score: fortune.wealth?.score || 0, desc: fortune.wealth?.desc || '', color: '#f59e0b' },
    { key: 'health', name: '\u5065\u5eb7', emoji: '\ud83c\udf3f', score: fortune.health?.score || 0, desc: fortune.health?.desc || '', color: '#10b981' },
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
      this._loadWithFallback(sign, this.data.queryDate);
    }
  },

  onShow() {
    const saved = wx.getStorageSync(STORAGE_KEY) || '';
    if (saved && saved !== this.data.currentSign) {
      this.setData({ currentSign: saved, fortune: null, indices: [], error: '' });
      this._loadWithFallback(saved, this.data.queryDate);
    }
  },

  _cacheKey(sign, date) {
    return CACHE_PREFIX + sign + '_' + date;
  },

  // 1. Try local cache → 2. Try server cache
  _loadWithFallback(sign, date) {
    try {
      const cached = wx.getStorageSync(this._cacheKey(sign, date));
      if (cached && cached.fortune) {
        this.setData({ fortune: cached.fortune, indices: buildIndices(cached.fortune), error: '' });
        return;
      }
    } catch {}

    // Not in local cache — try server cache silently
    this._fetchServerCache(sign, date);
  },

  _fetchServerCache(sign, date) {
    const self = this;
    api.get('api/fortune/' + encodeURIComponent(sign) + '/' + date)
      .then(function(res) {
        if (res && res.fortune) {
          wx.setStorageSync(self._cacheKey(sign, date), { fortune: res.fortune, cachedAt: Date.now() });
          self.setData({ fortune: res.fortune, indices: buildIndices(res.fortune), error: '' });
        }
      })
      .catch(function() { /* 未命中缓存，静默忽略 */ });
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
    this._loadWithFallback(sign, this.data.queryDate);
  },

  onDateChange(e) {
    const date = e.detail.value;
    this.setData({ queryDate: date, fortune: null, indices: [], error: '' });
    if (this.data.currentSign) {
      this._loadWithFallback(this.data.currentSign, date);
    }
  },

  async queryFortune() {
    const { currentSign, queryDate, loading } = this.data;
    if (loading) return;
    if (!currentSign) {
      wx.showToast({ title: '\u8bf7\u5148\u9009\u62e9\u661f\u5ea7', icon: 'none' });
      return;
    }

    // 1. Local cache
    const cacheKey = this._cacheKey(currentSign, queryDate);
    try {
      const cached = wx.getStorageSync(cacheKey);
      if (cached && cached.fortune) {
        this.setData({ fortune: cached.fortune, indices: buildIndices(cached.fortune), error: '' });
        wx.showToast({ title: '\u5df2\u52a0\u8f7d\u7f13\u5b58\u8fd0\u52bf', icon: 'none', duration: 1500 });
        return;
      }
    } catch {}

    this.setData({ loading: true, error: '', fortune: null, indices: [] });

    // 2. Server cache (GET)
    try {
      const serverRes = await api.get('api/fortune/' + encodeURIComponent(currentSign) + '/' + queryDate);
      if (serverRes && serverRes.fortune) {
        wx.setStorageSync(cacheKey, { fortune: serverRes.fortune, cachedAt: Date.now() });
        wx.setStorageSync(STORAGE_KEY, currentSign);
        this.setData({ fortune: serverRes.fortune, indices: buildIndices(serverRes.fortune), loading: false });
        wx.showToast({ title: '\u8fd0\u52bf\u5df2\u9884\u751f\u6210', icon: 'none', duration: 1500 });
        return;
      }
    } catch {}

    // 3. Generate via POST (DeepSeek)
    try {
      const res = await api.post('api/fortune', { sign: currentSign, date: queryDate });
      const fortune = res.fortune;
      wx.setStorageSync(cacheKey, { fortune, cachedAt: Date.now() });
      wx.setStorageSync(STORAGE_KEY, currentSign);
      this.setData({ fortune, indices: buildIndices(fortune), loading: false });
    } catch (err) {
      this.setData({
        loading: false,
        error: err.message || '\u83b7\u53d6\u8fd0\u52bf\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5',
      });
    }
  },
});
