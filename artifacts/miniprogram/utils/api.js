function getToken() {
  return wx.getStorageSync('birthday_token') || '';
}

function getBase() {
  const app = getApp();
  return (app.globalData.apiBase || '').replace(/\/$/, '');
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
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // token 失效：清除本地凭证，跳回登录页
          wx.removeStorageSync('birthday_token');
          wx.removeStorageSync('birthday_userinfo');
          const app = getApp();
          if (app) { app.globalData.token = null; app.globalData.sessionReady = Promise.resolve(false); }
          wx.reLaunch({ url: '/pages/login/login' });
          reject(new Error('登录已过期，请重新登录'));
        } else {
          const msg = (res.data && res.data.error) ? res.data.error : ('请求失败 ' + res.statusCode);
          reject(new Error(msg));
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
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(res.data)); } catch { resolve(res.data); }
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
