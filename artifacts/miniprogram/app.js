const { API_BASE } = require('./config');

App({
  globalData: {
    apiBase: API_BASE,
    userInfo: null,
    token: null,
    sessionReady: null,
  },

  onLaunch() {
    const stored = wx.getStorageSync('birthday_token');
    if (stored) this.globalData.token = stored;
    this.globalData.sessionReady = this._silentLogin();
    this._checkUpdate();
  },

  onShow() {
    // 不在此处检测更新：onShow 每次切回前台都会执行，重复注册监听器会导致连续弹窗
  },

  _checkUpdate() {
    if (!wx.canIUse('getUpdateManager')) return;
    // 只允许注册一次，防止任何场景下重复注册监听器
    if (this._updateChecked) return;
    this._updateChecked = true;
    const self = this;
    const mgr = wx.getUpdateManager();

    // 检测微信是否发现了新版本（日志用，不影响流程）
    mgr.onCheckForUpdate(function (res) {
      console.log('[Update] 检测到新版本：', res.hasUpdate);
    });

    mgr.onUpdateReady(function () {
      if (self._updateModalShowing) return;
      self._updateModalShowing = true;
      wx.showModal({
        title: '发现新版本 🎉',
        content: '新版本已准备好，需要重启后才能继续使用。',
        confirmText: '立即重启',
        showCancel: false,
        success() {
          mgr.applyUpdate();
        },
        fail() {
          self._updateModalShowing = false;
        },
      });
    });

    mgr.onUpdateFailed(function () {
      console.log('[Update] 新版本下载失败');
      wx.showToast({ title: '新版本下载失败，请检查网络', icon: 'none', duration: 2500 });
    });
  },

  // 无感知自动保持登录态：
  //   1. 先用本地 token 调 /api/auth/me 验证是否有效（快，无感）
  //   2. 有效 → 直接复用，不重新走 wx.login（避免覆盖 sessionToken）
  //   3. 无效 / 无 token → 走 wx.login 静默换新 token
  //   4. 网络异常 → 保留旧 token，让页面级请求失败再处理
  _silentLogin() {
    const self = this;
    const existingToken = wx.getStorageSync('birthday_token');

    // 新用户：没有历史 token，必须手动授权登录
    if (!existingToken) {
      return Promise.resolve(false);
    }

    const base = (self.globalData.apiBase || '').replace(/\/$/, '');

    return new Promise(function (resolve) {
      // 第一步：验证现有 token 是否仍然有效
      wx.request({
        url: base + '/api/auth/me',
        method: 'GET',
        header: { Authorization: 'Bearer ' + existingToken },
        timeout: 8000,
        success: function (r) {
          if (r.statusCode === 200 && r.data && r.data.id) {
            // token 仍然有效，直接复用，缓存最新用户信息
            self.globalData.token = existingToken;
            if (r.data) wx.setStorageSync('birthday_userinfo', r.data);
            resolve(true);
            return;
          }

          // token 失效（401 等），尝试用 wx.login 静默换新 token
          self._refreshByWxLogin(existingToken, resolve);
        },
        fail: function () {
          // 网络异常：保留旧 token，让后续页面请求自行处理
          resolve(true);
        },
      });
    });
  },

  // 用 wx.login code 静默换取新 token（仅 token 失效时调用）
  _refreshByWxLogin(existingToken, resolve) {
    const self = this;
    const base  = (self.globalData.apiBase || '').replace(/\/$/, '');

    wx.login({
      timeout: 12000,
      success: function (loginRes) {
        wx.request({
          url: base + '/api/auth/wechat/login',
          method: 'POST',
          data: { code: loginRes.code },
          header: { 'Content-Type': 'application/json' },
          timeout: 15000,
          success: function (r) {
            if (r.statusCode >= 200 && r.statusCode < 300 && r.data && r.data.token) {
              wx.setStorageSync('birthday_token', r.data.token);
              self.globalData.token = r.data.token;
              if (r.data.user) wx.setStorageSync('birthday_userinfo', r.data.user);
              resolve(true);
            } else {
              // 换 token 失败：清除失效 token，强制用户手动登录
              wx.removeStorageSync('birthday_token');
              wx.removeStorageSync('birthday_userinfo');
              self.globalData.token = null;
              resolve(false);
            }
          },
          fail: function () {
            // 网络异常：保留旧 token
            resolve(!!existingToken);
          },
        });
      },
      fail: function () {
        resolve(!!existingToken);
      },
    });
  },
});
