/**
 * 小程序全局配置
 *
 * API_BASE 规则：
 *   开发调试：使用下方 Replit 开发域名（无需修改，已自动填入）
 *   正式发布：改为你在 Replit 部署后的 .replit.app 地址
 *
 * 微信开发者工具里调试时，请在「详情 → 本地设置」中勾选
 *   ✅ 不校验合法域名、业务域名、TLS版本以及HTTPS证书
 * 发布上线前，到微信公众平台「开发 → 开发管理 → 服务器域名」添加正式域名。
 */

// ─── 开发/调试地址（Replit 自动分配，直接使用）────────────────────────────
const DEV_BASE = "https://a62417b9-b4f5-42dc-9663-3a26a326bc88-00-1p8ghsswuvy21.spock.replit.dev";

// ─── 正式部署地址（发布后填写）───────────────────────────────────────────────
// const PROD_BASE = "https://your-app.replit.app";

const API_BASE = DEV_BASE;

module.exports = { API_BASE };
