/**
 * 小程序全局配置
 *
 * API_BASE 说明：
 *   - 开发版（开发者工具 / 体验版）：自动使用 DEV_BASE（Replit 开发域名）
 *   - 正式版（线上用户）：自动使用 PROD_BASE（正式域名）
 *
 * 如需手动指定，取消注释最后的 OVERRIDE 行并填入目标地址。
 *
 * 调试时若提示域名不合法，在微信开发者工具「详情 → 本地设置」中勾选
 *   ✅ 不校验合法域名、业务域名、TLS版本以及HTTPS证书
 * 发布前，到微信公众平台「开发 → 开发管理 → 服务器域名」添加正式域名。
 */

// ─── 开发/调试地址（Replit 自动分配） ─────────────────────────────────────────
const DEV_BASE = "https://76debcf2-6adf-4054-91f8-fc726024eff0-00-4f33o9grn512.sisko.replit.dev";

// ─── 正式部署地址 ─────────────────────────────────────────────────────────────
const PROD_BASE = "https://shengritong.kuixi.com";

// 根据微信环境自动切换：
//   envVersion === 'release'  → 正式版 → 线上服务器
//   envVersion === 'trial'    → 体验版 → 线上服务器
//   envVersion === 'develop'  → 开发版 → Replit 开发服务器
let API_BASE;
try {
  const env = __wxConfig && __wxConfig.envVersion;
  API_BASE = (env === 'release' || env === 'trial') ? PROD_BASE : DEV_BASE;
} catch (e) {
  // 如果无法获取环境信息，默认使用正式地址
  API_BASE = PROD_BASE;
}

// ─── 手动覆盖（调试用，优先级最高）──────────────────────────────────────────
// const API_BASE = PROD_BASE;   // 强制使用正式服务器
// const API_BASE = DEV_BASE;    // 强制使用开发服务器

module.exports = { API_BASE };
