function getAppInstance() {
  try {
    return getApp();
  } catch {
    return null;
  }
}

function getBase() {
  const app = getAppInstance();
  return ((app && app.globalData && app.globalData.apiBase) || "").replace(/\/$/, "");
}

function getAppKey() {
  const app = getAppInstance();
  return (app && app.globalData && app.globalData.appKey) || "xishi_toolbox_mp";
}

function getToken() {
  return wx.getStorageSync("xishi_token") || "";
}

function extractMsg(err) {
  if (!err) return "";
  if (typeof err === "string") return err;
  return err.message || err.errMsg || String(err);
}

function request(method, path, data) {
  const base = getBase();
  const url = `${base}/${path.replace(/^\//, "")}`;
  const token = getToken();

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data: data || undefined,
      timeout: 15000,
      header: {
        "Content-Type": "application/json",
        "x-app-key": getAppKey(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        if (res.statusCode === 401) {
          const errCode = (res.data && res.data.error) || "";
          // 仅当用户 token 明确失效时才跳转登录，避免管理接口等 401 误触发登出循环
          if (token && errCode === "Invalid token") {
            wx.removeStorageSync("xishi_token");
            wx.removeStorageSync("xishi_userinfo");
            const app = getAppInstance();
            if (app) {
              app.globalData.token = null;
              app.globalData.userInfo = null;
              app.globalData.sessionReady = Promise.resolve(false);
            }
            wx.reLaunch({ url: "/pages/login/login" });
            reject(new Error("登录已过期，请重新登录"));
            return;
          }
          const msg = errCode || `请求失败 ${res.statusCode}`;
          const error = new Error(msg);
          error.errorCode = errCode;
          error.statusCode = res.statusCode;
          reject(error);
          return;
        }
        const code = (res.data && res.data.error) || "";
        const msg = (res.data && res.data.message) || code || `请求失败 ${res.statusCode}`;
        const error = new Error(msg);
        error.errorCode = code;
        error.statusCode = res.statusCode;
        reject(error);
      },
      fail(err) {
        const raw = extractMsg(err);
        if (raw.includes("timeout")) {
          reject(new Error("网络超时，请检查网络连接后重试"));
        } else if (raw.includes("url not in domain") || raw.includes("invalid url")) {
          reject(new Error("域名未在白名单，请在开发者工具中勾选不校验合法域名"));
        } else {
          reject(new Error(raw || "网络错误"));
        }
      },
    });
  });
}

function uploadFile(path, filePath, name) {
  const base = getBase();
  const url = `${base}/${path.replace(/^\//, "")}`;
  const token = getToken();

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url,
      filePath,
      name: name || "image",
      timeout: 60000,
      header: {
        "x-app-key": getAppKey(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(res.data));
          } catch {
            resolve(res.data);
          }
          return;
        }
        if (res.statusCode === 401) {
          reject(new Error("登录已过期，请重新登录"));
          return;
        }
        reject(new Error(`上传失败 ${res.statusCode}`));
      },
      fail(err) {
        const raw = extractMsg(err);
        reject(new Error(raw || "上传失败"));
      },
    });
  });
}

module.exports = {
  get: (path) => request("GET", path, null),
  post: (path, data) => request("POST", path, data),
  put: (path, data) => request("PUT", path, data),
  del: (path) => request("DELETE", path, null),
  upload: uploadFile,
  getToken,
  getAppKey,
};
