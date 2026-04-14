/**
 * 小程序全局配置
 *
 * ★ 使用说明 ★
 *   开发/测试阶段 → API_BASE = DEV_BASE（指向 Replit 开发服务器）
 *   正式发布前    → API_BASE = PROD_BASE（指向正式部署服务器）
 *
 * 调试时若提示域名不合法，在微信开发者工具「详情 → 本地设置」中勾选
 *   ✅ 不校验合法域名、业务域名、TLS版本以及HTTPS证书
 * 发布前，到微信公众平台「开发 → 开发管理 → 服务器域名」添加正式域名。
 */

// ─── 开发/测试服务器（Replit）────────────────────────────────────────────────
const DEV_BASE = "https://76debcf2-6adf-4054-91f8-fc726024eff0-00-4f33o9grn512.sisko.replit.dev";

// ─── 正式部署服务器 ────────────────────────────────────────────────────────────
const PROD_BASE = "https://shengritong.kuixi.com";

// ★ 在这里切换环境 ★
// 开发测试期间使用 DEV_BASE；正式发布前改为 PROD_BASE
const API_BASE = PROD_BASE;

module.exports = { API_BASE };
