function getApp_() {
  return getApp();
}

function getToken() {
  return wx.getStorageSync('birthday_token') || '';
}

function request(method, path, data) {
  const app = getApp_();
  const base = (app.globalData.apiBase || '').replace(/\/$/, '');
  const url = base + '/' + path.replace(/^\//, '');
  const token = getToken();

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data: data || undefined,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const msg = (res.data && res.data.error) ? res.data.error : ('HTTP ' + res.statusCode);
          reject(new Error(msg));
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络错误'));
      },
    });
  });
}

function uploadFile(path, filePath, name) {
  const app = getApp_();
  const base = (app.globalData.apiBase || '').replace(/\/$/, '');
  const url = base + '/' + path.replace(/^\//, '');
  const token = getToken();

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url,
      filePath,
      name: name || 'image',
      header: {
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(res.data));
          } catch {
            resolve(res.data);
          }
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
  get: (path) => request('GET', path, null),
  post: (path, data) => request('POST', path, data),
  put: (path, data) => request('PUT', path, data),
  del: (path) => request('DELETE', path, null),
  upload: uploadFile,
};
