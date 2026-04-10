const TOKEN_KEY = 'birthday_token';
const DEVICE_ID_KEY = 'birthday_device_id';

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || null;
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token);
  const app = getApp();
  if (app) app.globalData.token = token;
}

function clearToken() {
  wx.removeStorageSync(TOKEN_KEY);
  const app = getApp();
  if (app) app.globalData.token = null;
}

function getOrCreateDeviceId() {
  let id = wx.getStorageSync(DEVICE_ID_KEY);
  if (!id) {
    id = 'wx-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    wx.setStorageSync(DEVICE_ID_KEY, id);
  }
  return id;
}

function isLoggedIn() {
  return !!getToken();
}

module.exports = { getToken, setToken, clearToken, getOrCreateDeviceId, isLoggedIn };
