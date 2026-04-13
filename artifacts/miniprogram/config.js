/**
 * 小程序全局配置
 *
 * API_BASE 规则：
 *   开发调试：使用下方 Replit 开发域名（无需修改，已自动填入）
 *   正式发布：改为你在服务器部署后的正式地址
 *
 * 微信开发者工具里调试时，请在「详情 → 本地设置」中勾选
 *   ✅ 不校验合法域名、业务域名、TLS版本以及HTTPS证书
 * 发布上线前，到微信公众平台「开发 → 开发管理 → 服务器域名」添加正式域名。
 */

// ─── 开发/调试地址（Replit 自动分配，直接使用）────────────────────────────
const DEV_BASE = "https://76debcf2-6adf-4054-91f8-fc726024eff0-00-4f33o9grn512.sisko.replit.dev";

// ─── 正式部署地址 ─────────────────────────────────────────────────────────────
const PROD_BASE = "https://shengritong.kuixi.com";

// 切换这里来选择使用哪个环境：PROD_BASE（正式）或 DEV_BASE（开发调试）
const API_BASE = PROD_BASE;

module.exports = { API_BASE };
