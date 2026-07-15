/**
 * 惜时工具箱小程序独立配置
 *
 * 本项目不与生日通小程序共用代码目录。
 * 统一后台通过 APP_KEY 区分应用数据、配置、登录和统计。
 */

const DEV_BASE = "http://127.0.0.1:3000";
const PROD_BASE = "https://tool.xishi24.com";

// 开发者工具本地调试可切换为 DEV_BASE，发布前使用 PROD_BASE。
const API_BASE = DEV_BASE;

const APP_KEY = "xishi_toolbox_mp";

module.exports = {
  API_BASE,
  APP_KEY,
};
