# 惜时工具箱微信小程序

这是独立于生日通小程序的微信小程序项目。

## 项目信息

- 目录：`artifacts/xishi-toolbox-miniprogram`
- 后台应用标识：`xishi_toolbox_mp`
- 生产域名：`https://tool.xishi24.com`
- 后台配置入口：生日通管理后台 → 多应用 → 惜时工具箱小程序

## 开发说明

1. 使用微信开发者工具打开本目录。
2. 将 `project.config.json` 中的 `appid` 替换为惜时工具箱小程序的真实 AppID。
3. 本地调试如需连接本机后端，可在 `config.js` 中把 `API_BASE` 临时切换为 `DEV_BASE`。
4. 发布前请确认 `API_BASE = PROD_BASE`，并在微信公众平台配置合法请求域名 `tool.xishi24.com`。

## 当前页面

- 首页：`pages/home/home`
- 工具列表：`pages/tools/tools`
- 我的：`pages/profile/profile`
- 登录：`pages/login/login`
- 协议：`pages/legal/legal`
- 日期计算：`pages/date-calc/date-calc`
- 年龄计算：`pages/age-calc/age-calc`
- 天数间隔：`pages/day-diff/day-diff`
- BMI 计算：`pages/bmi/bmi`

## 接入约定

所有请求都会携带：

- Header：`x-app-key: xishi_toolbox_mp`
- 登录请求 body：`appKey: "xishi_toolbox_mp"`

这样后台可以和生日通小程序 `birthday_mp` 独立区分用户来源、配置、登录方式和统计数据。
