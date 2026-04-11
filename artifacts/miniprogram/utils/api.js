function getToken() {
  return wx.getStorageSync('birthday_token') || '';
}

function getBase() {
  const app = getApp();
  return (app.globalData.apiBase || '').replace(/\/$/, '');
}

function request(method, path, data) {
  const base = getBase();
  const url  = base + '/' + path.replace(/^\//, '');
  const token = getToken();

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data: data || undefined,
      timeout: 10000,          // 10 秒超时，避免无限等待
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const msg = (res.data && res.data.error) ? res.data.error : ('请求失败 ' + res.statusCode);
          reject(new Error(msg));
        }
      },
      fail(err) {
        const msg = err.errMsg || '网络错误';
        // 域名未配置时给出明确提示
        if (msg.includes('url not in domain') || msg.includes('invalid url')) {
          reject(new Error('域名未在白名单，请在开发者工具「详情→本地设置」勾选"不校验合法域名"'));
        } else {
          reject(new Error(msg));
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
      timeout: 30000,
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
        reject(new Error(err.errMsg || '上传失败'));
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
