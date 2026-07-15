const TOKEN_KEY = 'birthday_token';
const DEVICE_ID_KEY = 'birthday_device_id';

function bumpAuthGeneration() {
  const app = getApp();
  const next = ((app && app.globalData.authGeneration) || 0) + 1;
  if (app) app.globalData.authGeneration = next;
  return next;
}

function getAuthGeneration() {
  const app = getApp();
  return (app && app.globalData.authGeneration) || 0;
}

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || null;
}

function setToken(token) {
  bumpAuthGeneration();
  wx.setStorageSync(TOKEN_KEY, token);
  const app = getApp();
  if (app) {
    app.globalData.token = token;
    app.globalData.sessionReady = Promise.resolve(true);
  }
}

function clearToken() {
  bumpAuthGeneration();
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync('birthday_userinfo');
  const app = getApp();
  if (app) {
    app.globalData.token = null;
    app.globalData.sessionReady = Promise.resolve(false);
  }
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

async function resolveLoggedIn() {
  const app = getApp();
  let loggedIn = false;
  if (app && app.globalData.sessionReady) {
    try {
      loggedIn = await app.globalData.sessionReady;
    } catch (e) {
      loggedIn = false;
    }
  } else {
    loggedIn = isLoggedIn();
  }
  return loggedIn && isLoggedIn();
}

module.exports = {
  getToken,
  setToken,
  clearToken,
  getOrCreateDeviceId,
  isLoggedIn,
  getAuthGeneration,
  bumpAuthGeneration,
  resolveLoggedIn,
};
