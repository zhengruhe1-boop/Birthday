const TOKEN_KEY = "xishi_token";
const USER_KEY = "xishi_userinfo";

function setSession(token, user) {
  if (token) wx.setStorageSync(TOKEN_KEY, token);
  if (user) wx.setStorageSync(USER_KEY, user);
  const app = getApp();
  if (app) {
    app.globalData.token = token || null;
    app.globalData.userInfo = user || null;
    app.globalData.sessionReady = Promise.resolve(!!token);
  }
}

function clearSession() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(USER_KEY);
  const app = getApp();
  if (app) {
    app.globalData.token = null;
    app.globalData.userInfo = null;
    app.globalData.sessionReady = Promise.resolve(false);
  }
}

function isLoggedIn() {
  return !!wx.getStorageSync(TOKEN_KEY);
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null;
}

function ensureLoggedIn(options) {
  if (isLoggedIn()) return true;
  const opts = options || {};
  const from = opts.from || "home";
  const redirect = opts.redirect || "";
  wx.showToast({ title: opts.message || "请先登录", icon: "none" });
  let url = "/pages/login/login?from=" + encodeURIComponent(from);
  if (redirect) {
    url += "&redirect=" + encodeURIComponent(redirect);
  }
  setTimeout(function () {
    wx.navigateTo({ url: url });
  }, opts.delay !== undefined ? opts.delay : 500);
  return false;
}

module.exports = {
  setSession,
  clearSession,
  isLoggedIn,
  getUser,
  ensureLoggedIn,
};
