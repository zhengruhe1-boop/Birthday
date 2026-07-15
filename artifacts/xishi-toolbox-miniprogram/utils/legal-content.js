const api = require("./api");

function loadLegalContent(type) {
  const app = getApp();
  const appKey = (app && app.globalData.appKey) || "xishi_toolbox_mp";
  return api.get(`api/apps/${appKey}/public-config`).then((data) => {
    const content = type === "privacy"
      ? data.content && data.content.privacyPolicy
      : data.content && data.content.termsOfService;
    return content || "管理员尚未配置内容。";
  });
}

module.exports = { loadLegalContent };
