# 生日通 · 产品需求文档（PRD）

> 版本：v1.0　　更新日期：2026-05-18

---

## 一、产品概述

### 1.1 产品名称
**生日通**（Birthday Tracker）

### 1.2 产品定位
面向微信用户的生日 & 纪念日智能提醒工具。用户通过微信小程序记录亲友生日、重要纪念日与倒计时事件，并通过微信公众号推送提醒，让用户不再错过每一个重要日子。

### 1.3 产品组成

| 端 | 技术栈 | 说明 |
|---|---|---|
| 微信小程序 | 原生小程序（JS + WXML + WXSS） | 面向 C 端用户的主要使用入口 |
| 管理后台（H5） | React + Vite + TypeScript | 运营人员使用，管理用户、内容、系统配置 |
| API 服务端 | Express + TypeScript + PostgreSQL（Drizzle ORM） | 统一后端服务，供小程序与 H5 调用 |

### 1.4 主色调
玫瑰红 `#f43f5e`，窗口背景 `#F4ECE8`

---

## 二、目标用户

| 用户群体 | 使用场景 |
|---|---|
| 普通微信用户 | 记录亲友生日、设置提醒，不错过重要日子 |
| 有记忆需求的用户 | 管理周年纪念日、倒计时事件 |
| 感性/情感化用户 | 通过时间胶囊留下文字/照片，在未来某天开启 |
| 星座爱好者 | 查看每日星座运势 |

---

## 三、功能模块总览

```
生日通小程序
├── 首页（Home）          每日提醒汇总 + 运势卡片 + 可开启胶囊
├── 工具箱（Tools）       日期计算器、年龄计算器 + 动态扩展工具
├── 个人中心（Profile）   用户信息、订阅管理、隐私与设置
│   ├── 关注公众号        开通微信提醒
│   ├── 消息订阅          小程序模板消息授权
│   ├── 隐藏事件          已隐藏的生日 & 事件管理
│   └── 法律信息          隐私政策 & 用户协议
├── 运势（Fortune）       星座运势详情页
├── 生日管理              添加/编辑/删除联系人生日
├── 事件管理              添加/编辑/删除纪念日、倒计时
└── 时间胶囊              创建/查看/开启时间胶囊
```

---

## 四、功能详细需求

### 4.1 首页（Home）

**功能说明：** 用户打开小程序后看到的主界面，聚合展示所有关键信息。

#### 4.1.1 生日提醒列表

| 分组 | 定义 |
|---|---|
| 即将到来（imminent） | 7 天内生日 |
| 近期（soon） | 7–30 天内生日 |
| 本月（monthly） | 当月所有生日 |

- 每条记录显示：姓名、关系、农历/公历标识、距今天数
- 点击条目跳转至编辑页

#### 4.1.2 运势卡片

- 展示当前用户设置的星座及今日运势摘要
- 副标题文案：「设置您的生日，查看每天运势」
- 点击进入运势详情页

#### 4.1.3 可开启时间胶囊提醒

- 首页展示"已到开启日期"的时间胶囊提示
- 点击跳转至胶囊详情页

---

### 4.2 生日联系人管理（Contact）

#### 4.2.1 添加/编辑联系人

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| 姓名 | 文本 | 是 | |
| 性别 | 单选 | 否 | 男 / 女 / 未知 |
| 生日 | 日期 | 是 | 支持公历/农历切换 |
| 出生年份 | 数字 | 否 | 用于年龄计算 |
| 关系 | 文本 | 否 | 如：朋友、同事、家人 |
| 提醒邮件 | 文本 | 否 | 发送邮件提醒至指定邮箱 |
| 提前天数 | 多选 | 否 | 0天当天、1天前、3天前等 |
| 提醒时间（小时） | 数字 | 否 | 0–23 点 |

#### 4.2.2 隐藏联系人

- 可将联系人从主列表隐藏（不删除）
- 在「隐藏事件」页面可查看并「移出隐藏」恢复

#### 4.2.3 删除联系人

- 点击删除弹出确认对话框，确认后彻底删除

---

### 4.3 事件管理（Event）

支持三类事件：

| 类型 | 说明 |
|---|---|
| 周年纪念日（anniversary） | 每年循环，如结婚纪念日 |
| 倒计时（countdown） | 特定未来日期，如考试/旅行 |
| 普通提醒（other） | 一次性提醒 |

**字段与生日联系人类似**，额外包含：
- 事件日期（精确到天）
- 提醒时间（精确到分钟，格式 `YYYY-MM-DD HH:mm`）

---

### 4.4 时间胶囊（Time Capsule）

#### 4.4.1 创建胶囊

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| 标题 | 文本 | 是 | 胶囊名称 |
| 心情/内容 | 长文本 | 是 | 写给未来的话 |
| 照片 | 图片列表 | 否 | 支持多张上传 |
| 开启日期 | 日期 | 是 | 必须为未来日期 |
| 到期微信提醒 | 开关 | 否 | 开启日期当天通过公众号提醒 |

#### 4.4.2 查看胶囊详情

| 状态 | 交互 |
|---|---|
| 未到开启日期（锁定中） | 内容模糊展示，可编辑/删除 |
| 已到或超过开启日期（已开启） | 内容完整展示，仅可删除（全宽按钮） |

#### 4.4.3 胶囊列表

- 按状态分组展示（锁定中 / 可开启）
- 可开启胶囊在首页有额外入口提示

---

### 4.5 运势（Fortune）

#### 4.5.1 设置生日

- 用户选择出生日期（日期选择器，格式 YYYY-MM-DD）
- 系统根据月日自动推算星座（`getSignFromMonthDay()`）
- 生日存储至 `fortune_my_birthday`，星座同步更新 `fortune_sign`

#### 4.5.2 查看运势

- 展示当日星座运势内容（由 AI 生成并缓存）
- 运势数据后端按星座 + 日期缓存，同天同星座不重复生成

---

### 4.6 工具箱（Tools）

#### 4.6.1 内置工具

| 工具 | 功能 |
|---|---|
| 日期计算器 | 计算两个日期之间的天数差，或某日期加减 N 天后的日期 |
| 年龄计算器 | 输入生日，精确展示年/月/日龄，附带星座、生肖、人生阶段信息 |

#### 4.6.2 动态工具

- 后端 `mp_tools` 表维护扩展工具列表
- 支持跳转至其他小程序（`navigate` 类型）或内部页面（`page` 类型）
- 由管理后台配置，排序、启用/禁用均可控

---

### 4.7 个人中心（Profile）

| 功能 | 说明 |
|---|---|
| 用户信息展示 | 头像、昵称、账号类型标签 |
| 关注公众号 | 引导用户关注生日通公众号，检测是否已关注 |
| 消息订阅 | 微信小程序模板消息授权（服务消息）|
| 隐藏事件 | 查看和恢复隐藏的联系人与事件 |
| 法律信息 | 隐私政策 & 用户协议 |
| 退出登录 | 清除 token，跳转登录页 |
| 配额管理 | 查看当前使用量，通过邀请/操作领取额外配额 |

---

### 4.8 提醒通知体系

#### 4.8.1 微信公众号推送

- 用户关注生日通公众号后绑定 `oaOpenId`
- 在生日/纪念日/时间胶囊到期前，通过公众号推送模板消息
- 提前天数和发送时间可在联系人/事件级别自定义

#### 4.8.2 小程序订阅消息

- 用户在「消息订阅」页主动授权模板消息权限（`mpSubscribed`）
- 作为公众号推送的补充渠道

#### 4.8.3 邮件提醒

- 每条生日/事件支持配置接收提醒的邮箱
- 服务端任务在提醒时间触发邮件发送

---

### 4.9 版本更新提示

- 小程序启动时（`onLaunch`）监听 `wx.getUpdateManager`
- 新版本下载完成后弹出**强制重启**弹框，无取消按钮
- 弹框文案：「发现新版本 🎉 · 新版本已准备好，需要重启后才能继续使用」
- 下载失败时 Toast 提示「新版本下载失败，请检查网络」

---

### 4.10 静默登录 & 会话保持

流程如下：

```
App 启动
 └── 本地有 token？
      ├── 是 → GET /api/auth/me 验证有效性
      │         ├── 有效 → 复用 token（无感）
      │         └── 无效 → wx.login 换新 token
      │                     ├── 成功 → 更新 token
      │                     └── 失败 → 清除 token，跳登录页
      └── 否 → 等待用户手动登录（首次用户）
```

---

## 五、管理后台功能

> 访问地址：生日通 H5 管理后台，需输入管理密钥

### 5.1 数据统计（Stats）

| 指标 | 说明 |
|---|---|
| 总用户数 | 注册用户总量 |
| 总联系人数 | 所有用户录入的生日联系人总数 |
| 总事件数 | 纪念日/倒计时/提醒总数 |
| 总胶囊数 | 时间胶囊总数 |

- 分页展示用户列表，每用户显示：昵称、头像、账号类型、联系人数、注册时间、最后活跃时间
- 账号类型标签：测试账号 / 微信小程序 / 微信公众号 / 小程序+公众号 / 早期用户
- 支持展开查看用户的联系人详情

### 5.2 微信配置

#### 公众号配置
- AppID / AppSecret（密文存储，可覆盖）
- 服务器 Token（用于公众号 Webhook 签名验证）
- 网站域名（用于 OAuth 回调地址自动生成）
- 公众号名称（显示在 H5 引导横幅）

#### 小程序配置
- AppID / AppSecret（密文存储，可覆盖）

#### 登录模式切换
| 端 | 模式选项 |
|---|---|
| H5 网页 | 微信公众号 OAuth 登录 / 测试昵称登录 |
| 小程序 | 微信小程序登录 / 测试 Mock 登录 |

### 5.3 内容配置

- 应用名称、LOGO、Slogan 等基础内容配置

### 5.4 运势配置

- AI 运势生成开关及相关参数配置

### 5.5 AI 配置

- AI 服务商、API Key、模型选择等参数（如 DeepSeek）

### 5.6 通知配置

- 邮件服务配置（SMTP 等）
- 提醒推送参数

### 5.7 工具管理

- 添加/编辑/删除动态工具
- 配置工具名称、图标、类型（内页 / 跳转小程序）、排序、启用状态

### 5.8 运营操作

| 操作 | 说明 |
|---|---|
| 手动触发通知 | 立即执行一次提醒推送任务 |
| OA 粉丝同步 | 将公众号关注用户的 oaOpenId 同步至数据库 |
| AI 生成测试 | 测试运势内容生成是否正常 |

---

## 六、数据模型

### 6.1 用户（users）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | serial PK | 用户 ID |
| openId | text unique | 微信小程序 OpenID |
| unionId | text | 微信 UnionID |
| oaOpenId | text | 微信公众号 OpenID（关注后绑定） |
| nickname | text | 昵称 |
| avatarUrl | text | 头像 URL |
| mpSubscribed | boolean | 是否已授权小程序订阅消息 |
| extraQuota | integer | 通过邀请/操作获得的额外配额 |
| fortune_sign | text | 星座（由生日推算后存储） |
| createdAt | timestamp | 注册时间 |
| lastAccessAt | timestamp | 最后活跃时间 |

### 6.2 联系人（contacts）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | serial PK | |
| userId | integer FK | 所属用户 |
| name | text | 姓名 |
| birthdayMonth | integer | 生日月 |
| birthdayDay | integer | 生日日 |
| birthdayLunar | boolean | 是否农历 |
| birthYear | integer | 出生年份（可空） |
| gender | text | male / female / null |
| relation | text | 关系 |
| reminderEmail | text | 提醒邮箱 |
| reminderDaysBefore | text | 提前天数，逗号分隔，如 "0,1,3" |
| reminderSendHour | integer | 发送小时（0–23） |
| hidden | boolean | 是否已隐藏 |

### 6.3 事件（events）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | serial PK | |
| userId | integer FK | |
| type | text | anniversary / countdown / other |
| name | text | 事件名称 |
| eventDate | text | ISO 日期 YYYY-MM-DD |
| reminderTime | text | ISO 精确时间 YYYY-MM-DD HH:mm |
| reminderEmail | text | |
| reminderDaysBefore | text | |
| reminderSendHour | integer | |
| hidden | boolean | |

### 6.4 时间胶囊（time_capsules）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | serial PK | |
| userId | integer | |
| title | text | 胶囊标题 |
| message | text | 内容正文 |
| photoUrls | text | JSON 数组字符串，存储图片 URL |
| openAt | text | 开启日期 YYYY-MM-DD |
| opened | boolean | 是否已到开启日期 |
| notifyEnabled | boolean | 是否开启到期微信提醒 |

### 6.5 运势缓存（fortune_cache）

| 字段 | 类型 | 说明 |
|---|---|---|
| sign | text | 星座 |
| date | text | 日期 YYYY-MM-DD |
| data | jsonb | AI 生成的运势内容 |

### 6.6 系统配置（settings）

键值对存储，key 唯一，用于存储微信配置、AI 参数、内容配置等运营级配置。

### 6.7 小程序工具（mp_tools）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | serial PK | |
| name | text | 工具名称 |
| description | text | 工具描述 |
| icon | text | 图标（Emoji 或图片 URL） |
| type | text | page（内页）/ navigate（跳转小程序） |
| path | text | 内页路径（type=page 时） |
| app_id | text | 目标小程序 AppID（type=navigate 时） |
| page_path | text | 目标小程序页面路径 |
| sort_order | integer | 排序权重 |
| enabled | boolean | 是否启用 |

---

## 七、API 接口一览

### 认证相关（/api/auth）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/wechat/login` | 微信小程序 code 换 token |
| POST | `/mock-login` | 测试昵称登录（仅开发模式） |
| GET | `/me` | 获取当前用户信息 |
| PUT | `/me` | 更新用户信息（昵称、头像等） |
| POST | `/logout` | 退出登录 |
| GET | `/wechat/subscribe-status` | 检查公众号关注状态 |
| GET | `/mp-subscribe-info` | 获取小程序订阅消息模板信息 |
| POST | `/mp-subscribe` | 更新订阅消息授权状态 |
| GET | `/legal` | 获取隐私政策 & 用户协议 |

### 联系人（/api/contacts）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 获取联系人列表（支持 search 参数） |
| POST | `/` | 创建联系人 |
| GET | `/:id` | 获取单个联系人 |
| PUT | `/:id` | 更新联系人（含 hidden 字段） |
| DELETE | `/:id` | 删除联系人 |
| GET | `/upcoming` | 获取分组即将生日列表 |
| GET | `/hidden` | 获取已隐藏联系人列表 |

### 事件（/api/events）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 获取事件列表 |
| GET | `/upcoming` | 获取活跃事件（按类型分组） |
| POST | `/` | 创建事件 |
| PUT | `/:id` | 更新事件 |
| DELETE | `/:id` | 删除事件 |

### 时间胶囊（/api/capsules）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 获取胶囊列表 |
| POST | `/` | 创建胶囊 |
| GET | `/:id` | 获取单个胶囊详情 |
| PUT | `/:id` | 更新胶囊 |
| DELETE | `/:id` | 删除胶囊 |

### 运势（/api/fortune）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/:sign/:date` | 获取缓存运势 |
| POST | `/` | 生成（或获取缓存）运势 |

### 其他

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/upload` | 上传图片，返回 URL |
| GET | `/api/quota/config` | 获取用户配额配置 |
| POST | `/api/quota/claim` | 领取额外配额 |
| GET | `/api/mp-tools` | 获取动态工具列表 |
| GET | `/api/mp-tools/builtin` | 获取内置工具列表 |
| GET | `/healthz` | 服务健康检查 |

### 管理后台（/api/admin，需 x-admin-key 请求头）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/stats` | 用户与数据统计 |
| GET/PUT | `/wechat-config` | 微信配置读写 |
| GET/PUT | `/content-config` | 内容配置读写 |
| GET/PUT | `/fortune-config` | 运势配置读写 |
| GET/PUT | `/ai-config` | AI 配置读写 |
| GET/PUT | `/notify-config` | 通知配置读写 |
| POST | `/notify-run` | 手动触发通知推送 |
| POST | `/oa-sync` | 公众号粉丝同步 |
| POST | `/ai-test` | AI 生成测试 |
| GET/POST/PUT/DELETE | `/tools` | 工具管理 CRUD |

### 微信公众号 Webhook（/api/wechat/oa）

| 方法 | 说明 |
|---|---|
| GET | 服务器验证（Token 签名校验） |
| POST | 接收公众号事件（关注/取关等） |

---

## 八、非功能性需求

### 8.1 性能
- 首页生日列表接口响应时间 ≤ 800ms
- 运势内容优先读缓存，缓存命中时响应时间 ≤ 300ms
- 图片上传支持压缩，单张限制 ≤ 5MB

### 8.2 安全
- 所有 C 端接口需携带 JWT Token（`Authorization: Bearer <token>`）
- 管理后台接口需携带 `x-admin-key` 请求头
- AppSecret 等敏感配置密文存储，接口不返回明文
- 微信公众号 Webhook 需通过 Token 签名验证

### 8.3 兼容性
- 小程序基础库最低版本：2.10.0
- 使用 `wx.canIUse()` 做降级处理（如版本更新 API）

### 8.4 数据存储
- 本地缓存 Key 规范：
  - `birthday_token` — JWT 登录凭证
  - `birthday_userinfo` — 用户基本信息（昵称、头像）
  - `fortune_my_birthday` — 用户填写的出生日期（YYYY-MM-DD）
  - `fortune_sign` — 当前星座

---

## 九、页面路由

### 小程序页面路径

| 页面 | 路径 | Tab 页 |
|---|---|---|
| 首页 | `pages/home/home` | ✅ |
| 工具箱 | `pages/tools/tools` | ✅ |
| 个人中心 | `pages/profile/profile` | ✅ |
| 运势详情 | `pages/fortune/fortune` | — |
| 登录 | `pages/login/login` | — |
| 添加/编辑联系人 | `pages/contact-form/contact-form` | — |
| 添加/编辑事件 | `pages/event-form/event-form` | — |
| 创建/编辑时间胶囊 | `pages/time-capsule-form/time-capsule-form` | — |
| 时间胶囊详情 | `pages/time-capsule-detail/time-capsule-detail` | — |
| 隐藏事件 | `pages/hidden-events/hidden-events` | — |
| 消息订阅 | `pages/subscribe/subscribe` | — |
| 关注公众号 | `pages/follow-oa/follow-oa` | — |
| 配额管理 | `pages/quota-paywall/quota-paywall` | — |
| 日期计算器 | `pages/date-calc/date-calc` | — |
| 年龄计算器 | `pages/age-calc/age-calc` | — |
| 法律信息 | `pages/legal/legal` | — |

---

## 十、后续迭代方向（Backlog）

- [ ] 生日联系人支持设置头像
- [ ] 支持批量导入联系人（从手机通讯录）
- [ ] 时间胶囊支持分享给好友（需开启时才可查看）
- [ ] 运势支持按周/月查看历史运势
- [ ] 管理后台支持批量发送推送消息
- [ ] 数据导出功能（CSV / 备份）
- [ ] 国际化支持（繁体中文、英文）
