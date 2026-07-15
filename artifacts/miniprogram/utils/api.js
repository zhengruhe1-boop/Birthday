function getToken() {
  return wx.getStorageSync('birthday_token') || '';
}

function getBase() {
  const app = getApp();
  return (app.globalData.apiBase || '').replace(/\/$/, '');
}

function getAppKey() {
  const app = getApp();
  return (app.globalData && app.globalData.appKey) || 'birthday_mp';
}

function isOnLoginPage() {
  const pages = getCurrentPages();
  if (!pages.length) return false;
  return pages[pages.length - 1].route === 'pages/login/login';
}

let reloginPending = false;

function handleUnauthorized(hadToken) {
  if (!hadToken) return;
  const { clearToken } = require('./auth');
  clearToken();
  if (!reloginPending && !isOnLoginPage()) {
    reloginPending = true;
    wx.reLaunch({ url: '/pages/login/login' });
    setTimeout(function () { reloginPending = false; }, 1500);
  }
}

// 把 wx 回调的 errMsg / message 统一提取成字符串
function extractMsg(err) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  return err.message || err.errMsg || String(err);
}

function request(method, path, data) {
  const base  = getBase();
  const url   = base + '/' + path.replace(/^\//, '');
  const token = getToken();

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data: data || undefined,
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        'x-app-key': getAppKey(),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          handleUnauthorized(!!token);
          reject(new Error('登录已过期，请重新登录'));
        } else {
          const errorCode = (res.data && res.data.error) || '';
          const msg = (res.data && res.data.message) || errorCode || ('请求失败 ' + res.statusCode);
          const err = new Error(msg);
          err.errorCode = errorCode;
          err.statusCode = res.statusCode;
          reject(err);
        }
      },
      fail(err) {
        const raw = extractMsg(err);
        if (raw.includes('timeout')) {
          reject(new Error('网络超时，请检查网络连接后重试'));
        } else if (raw.includes('url not in domain') || raw.includes('invalid url')) {
          reject(new Error('域名未在白名单，请在开发者工具「详情→本地设置」勾选"不校验合法域名"'));
        } else {
          reject(new Error(raw || '网络错误'));
        }
      },
    });
  });
}

function uploadFile(path, filePath, name) {
  const base  = getBase();
  const url   = base + '/' + path.replace(/^\//, '');
  const token = getToken();

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url,
      filePath,
      name: name || 'image',
      timeout: 60000,
      header: {
        'x-app-key': getAppKey(),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(res.data)); } catch { resolve(res.data); }
        } else if (res.statusCode === 401) {
          handleUnauthorized(!!token);
          reject(new Error('登录已过期，请重新登录'));
        } else {
          reject(new Error('上传失败 ' + res.statusCode));
        }
      },
      fail(err) {
        const raw = extractMsg(err);
        if (raw.includes('timeout')) {
          reject(new Error('上传超时，请检查网络后重试'));
        } else {
          reject(new Error(raw || '上传失败'));
        }
      },
    });
  });
}

module.exports = {
  get:    (path)       => request('GET',    path, null),
  post:   (path, data) => request('POST',   path, data),
  put:    (path, data) => request('PUT',    path, data),
  del:    (path)       => request('DELETE', path, null),
  upload: uploadFile,
};
