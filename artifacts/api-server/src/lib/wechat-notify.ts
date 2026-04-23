import { db, contactsTable, usersTable, settingsTable, eventsTable } from "@workspace/db";
import { isNotNull, eq, and, isNull } from "drizzle-orm";
import { calcDaysUntilBirthday } from "./birthday.js";
import { logger } from "./logger.js";

// ── Fixed template variable keys (must match the WeChat template) ─────────────
const TMPL_VAR_NAME = "thing19";   // 姓名 + 事件类型，e.g. "张三 · 生日"
const TMPL_VAR_TIME = "time24";    // 事件日期时间，e.g. "2026-04-10 08:00"

// ── User's actual template ID (hard-coded as default) ─────────────────────────
const DEFAULT_TEMPLATE_ID = "iKiueM36DMAWXrO4VQMK68ulAFDz_51ylIBZt_AMw9w";

// 注：miniprogram 跳转需要小程序已在微信开放平台与公众号绑定且有线上版本；
// 未满足条件时 WeChat API 返回 40165 拒绝整条消息，因此默认不加 miniprogram 字段，
// 改为可选的 url 字段（指向 H5 网页），安全起见留空则不添加。
const H5_NOTIFY_URL_KEY = "notify_h5_url";   // 设置项 key，可在 DB settings 里配置

// ── In-memory access token cache ──────────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

// ── DB helpers ────────────────────────────────────────────────────────────────
async function getSettingLocal(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

async function setSettingLocal(key: string, value: string): Promise<void> {
  const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  if (existing.length > 0) {
    await db.update(settingsTable).set({ value, updatedAt: new Date() }).where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({ key, value });
  }
}

// ── WeChat access token ───────────────────────────────────────────────────────
export async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const appId     = await getSettingLocal("wechat_appid");
  const appSecret = await getSettingLocal("wechat_appsecret");
  if (!appId || !appSecret) return null;

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`;
  let data: { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };
  try {
    const res = await fetch(url);
    data = await res.json();
  } catch (err) {
    logger.error({ err }, "Network error fetching WeChat access token");
    return null;
  }

  if (!data.access_token) {
    logger.error({ errcode: data.errcode, errmsg: data.errmsg }, "Failed to get WeChat access token");
    return null;
  }

  cachedToken = {
    token:     data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  };
  return cachedToken.token;
}

// ── Config types ──────────────────────────────────────────────────────────────
export interface NotifyConfig {
  enabled:       boolean;
  daysBefore:    number[];
  sendHour:      number;
  templateId:    string;
  h5Url:         string;
  lastRunAt:     string | null;
  lastRunResult: { sent: number; skipped: number; errors: number } | null;
}

export async function getNotifyConfig(): Promise<NotifyConfig> {
  const [enabled, daysBefore, sendHour, templateId, h5Url, lastRunAt, lastResult] =
    await Promise.all([
      getSettingLocal("notify_enabled"),
      getSettingLocal("notify_days_before"),
      getSettingLocal("notify_send_hour"),
      getSettingLocal("notify_template_id"),
      getSettingLocal(H5_NOTIFY_URL_KEY),
      getSettingLocal("notify_mp_last_run"),
      getSettingLocal("notify_mp_last_result"),
    ]);

  return {
    enabled:       enabled !== "false",   // 未配置时默认开启
    daysBefore:    daysBefore ? daysBefore.split(",").map(Number).filter(n => !isNaN(n)) : [0, 1],
    sendHour:      sendHour ? parseInt(sendHour, 10) : 8,
    templateId:    templateId ?? DEFAULT_TEMPLATE_ID,
    h5Url:         h5Url ?? "",
    lastRunAt,
    lastRunResult: lastResult ? JSON.parse(lastResult) : null,
  };
}

// ── Format helpers ────────────────────────────────────────────────────────────

// WeChat time24 类型：日期事件只传 YYYY-MM-DD，其它提醒（有具体时分）传 YYYY-MM-DD HH:mm
function toDateStr(dateStr: string): string {
  return dateStr.slice(0, 10);
}

function toDateTimeStr(dateStr: string, hour = 0, minute = 0): string {
  const date = dateStr.slice(0, 10);
  const hh   = String(hour).padStart(2, "0");
  const mm   = String(minute).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}

// WeChat thing19 类型最多 20 字，超长截断加省略号
function truncateThing(str: string, max = 20): string {
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

function thisYearDate(month: number, day: number): string {
  const now = new Date();
  const y   = now.getFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(month)}-${pad(day)}`;
}

function daysUntilDate(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function daysUntilAnniversary(dateStr: string): { days: number; targetDate: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d       = new Date(dateStr + "T00:00:00");
  const thisYr  = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (thisYr < today) thisYr.setFullYear(today.getFullYear() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateOut = `${thisYr.getFullYear()}-${pad(thisYr.getMonth() + 1)}-${pad(thisYr.getDate())}`;
  return {
    days:       Math.round((thisYr.getTime() - today.getTime()) / 86400000),
    targetDate: dateOut,
  };
}

// ── Notification item ─────────────────────────────────────────────────────────
interface NotifyItem {
  openId:    string;
  nameField: string;
  timeField: string;
  label:     string;
}

// ── Send single template message ──────────────────────────────────────────────
async function sendTemplateMsg(
  token: string,
  templateId: string,
  item: NotifyItem,
): Promise<{ ok: boolean; errcode?: number; errmsg?: string }> {
  // 读取可选的 H5 跳转 URL（空值时不添加 url 字段，避免因无效地址报错）
  const h5Url = await getSettingLocal(H5_NOTIFY_URL_KEY);

  const payload: Record<string, unknown> = {
    touser:      item.openId,
    template_id: templateId,
    // 注意：不添加 miniprogram 字段
    // 原因：小程序与公众号未在开放平台绑定 or 小程序没有线上版本时，
    //       WeChat 会返回 40165（invalid weapp pagepath）并拒绝整条消息
    data: {
      [TMPL_VAR_NAME]: { value: item.nameField },
      [TMPL_VAR_TIME]: { value: item.timeField },
    },
  };

  // 仅当 H5 URL 已配置时才添加 url 字段（用户点击通知后打开 H5 网页）
  if (h5Url) {
    payload.url = h5Url;
  }

  logger.info({ label: item.label, nameField: item.nameField, timeField: item.timeField },
    "Sending WeChat template message");

  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
  );
  const data = await res.json() as { errcode?: number; errmsg?: string };
  if (data.errcode === 0 || data.errmsg === "ok") {
    logger.info({ label: item.label }, "WeChat template message sent OK");
    return { ok: true };
  }
  logger.error({ errcode: data.errcode, errmsg: data.errmsg, label: item.label, nameField: item.nameField, timeField: item.timeField },
    "Failed to send WeChat template message");
  return { ok: false, errcode: data.errcode, errmsg: data.errmsg };
}

// ── Build notification items for a user ──────────────────────────────────────
async function buildItems(
  userId: number,
  oaOpenId: string,
  daysBefore: number[],
): Promise<NotifyItem[]> {
  const items: NotifyItem[] = [];

  // 1. Contacts → 生日（只显示日期，不显示 00:00）
  const contacts = await db.select().from(contactsTable).where(eq(contactsTable.userId, userId));
  for (const c of contacts) {
    const days = calcDaysUntilBirthday(c.birthdayMonth, c.birthdayDay, c.birthYear ?? undefined, c.birthdayLunar);
    if (!daysBefore.includes(days)) continue;
    const dateStr = thisYearDate(c.birthdayMonth, c.birthdayDay);
    items.push({
      openId:    oaOpenId,
      nameField: truncateThing(`${c.name} · 生日`),
      timeField: toDateStr(dateStr),
      label:     `contact:${c.id} 生日`,
    });
  }

  // 2. Events（纪念日 / 倒数日 / 其它）
  const events = await db.select().from(eventsTable).where(eq(eventsTable.userId, userId));
  for (const e of events) {
    if (e.type === "anniversary" && e.eventDate) {
      const { days, targetDate } = daysUntilAnniversary(e.eventDate);
      if (!daysBefore.includes(days)) continue;
      const rawName = `${e.name}${e.person ? `(${e.person})` : ""} · 纪念日`;
      items.push({
        openId:    oaOpenId,
        nameField: truncateThing(rawName),
        timeField: toDateStr(targetDate),   // 纪念日只显示日期
        label:     `event:${e.id} 纪念日`,
      });
    } else if (e.type === "countdown" && e.eventDate) {
      const days = daysUntilDate(e.eventDate);
      if (!daysBefore.includes(days)) continue;
      items.push({
        openId:    oaOpenId,
        nameField: truncateThing(`${e.name} · 倒数日`),
        timeField: toDateStr(e.eventDate),  // 倒数日只显示日期
        label:     `event:${e.id} 倒数日`,
      });
    } else if (e.type === "other" && e.reminderTime) {
      // 其它提醒有具体时分，完整显示
      const dateStr = e.reminderTime.slice(0, 10);
      const days    = daysUntilDate(dateStr);
      if (!daysBefore.includes(days)) continue;
      const hh = e.reminderTime.slice(11, 13);
      const mm = e.reminderTime.slice(14, 16);
      items.push({
        openId:    oaOpenId,
        nameField: truncateThing(`${e.name} · 其它`),
        timeField: toDateTimeStr(dateStr, parseInt(hh, 10) || 0, parseInt(mm, 10) || 0),
        label:     `event:${e.id} 其它`,
      });
    }
  }

  return items;
}

// ── 通过 OA 关注列表 + unionId 自动回填 oaOpenId ──────────────────────────────
// 适用场景：OA 与 MP 同属一个微信开放平台，历史关注者 oaOpenId 尚未写入。
// 每次通知前调用，最多页次 = ceil(关注人数 / 10000)，耗时秒级。
export async function syncOaOpenIds(token: string): Promise<{ synced: number; errors: number }> {
  const result = { synced: 0, errors: 0 };

  try {
    // 第一步：遍历关注列表，拿到所有 OA openId
    const allOaOpenIds: string[] = [];
    let nextOpenId = "";
    let pageNum = 0;

    do {
      pageNum++;
      const url = `https://api.weixin.qq.com/cgi-bin/user/get?access_token=${token}` +
        (nextOpenId ? `&next_openid=${encodeURIComponent(nextOpenId)}` : "");

      const resp = await fetch(url);
      const page = await resp.json() as {
        count?: number;
        data?: { openid?: string[] };
        next_openid?: string;
        errcode?: number;
        errmsg?: string;
      };

      if (page.errcode) {
        logger.error({ errcode: page.errcode, errmsg: page.errmsg }, "syncOaOpenIds: follower list error");
        result.errors++;
        break;
      }

      const ids = page.data?.openid ?? [];
      allOaOpenIds.push(...ids);

      // 下一页游标为空 or 与当前相同时，停止翻页
      const next = page.next_openid ?? "";
      nextOpenId = (next && next !== nextOpenId) ? next : "";
    } while (nextOpenId && pageNum < 100);  // 最多 100 页（1000 万关注者）

    if (allOaOpenIds.length === 0) {
      logger.info("syncOaOpenIds: no OA followers found");
      return result;
    }

    logger.info({ total: allOaOpenIds.length }, "syncOaOpenIds: fetched follower list");

    // 第二步：批量获取关注者的 unionId（每批最多 100 个）
    for (let i = 0; i < allOaOpenIds.length; i += 100) {
      const batch = allOaOpenIds.slice(i, i + 100);
      try {
        const batchResp = await fetch(
          `https://api.weixin.qq.com/cgi-bin/user/info/batchget?access_token=${token}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_list: batch.map(openid => ({ openid, lang: "zh_CN" })) }),
          },
        );
        const batchData = await batchResp.json() as {
          user_info_list?: Array<{
            openid:   string;
            unionid?: string;
            subscribe?: number;
          }>;
          errcode?: number;
          errmsg?: string;
        };

        if (batchData.errcode) {
          logger.error({ errcode: batchData.errcode }, "syncOaOpenIds: batchget error");
          result.errors++;
          continue;
        }

        for (const info of batchData.user_info_list ?? []) {
          if (!info.unionid || !info.openid) continue;

          // 找到 DB 中 unionId 匹配、oaOpenId 为空的 MP 用户
          const mp = await db.select({ id: usersTable.id, oaOpenId: usersTable.oaOpenId })
            .from(usersTable)
            .where(and(
              eq(usersTable.unionId, info.unionid),
              isNotNull(usersTable.openId),   // MP 用户必须有 openId
            ))
            .limit(1);

          if (mp.length === 0) continue;
          const user = mp[0];

          // 如果已经设置了正确的 oaOpenId，跳过
          if (user.oaOpenId === info.openid) continue;

          await db.update(usersTable)
            .set({ oaOpenId: info.openid })
            .where(eq(usersTable.id, user.id));

          result.synced++;
          logger.info({ userId: user.id, oaOpenId: info.openid, unionid: info.unionid },
            "syncOaOpenIds: oaOpenId populated via unionId");
        }
      } catch (err) {
        logger.error({ err, batchIndex: i }, "syncOaOpenIds: batch processing error");
        result.errors++;
      }
    }
  } catch (err) {
    logger.error({ err }, "syncOaOpenIds: unexpected error");
    result.errors++;
  }

  logger.info(result, "syncOaOpenIds: sync complete");
  return result;
}

// ── Main notification runner ──────────────────────────────────────────────────
export async function runWechatBirthdayNotifications(): Promise<{
  sent: number; skipped: number; errors: number;
  errorSamples?: Array<{ label: string; errcode?: number; errmsg?: string }>;
  syncResult?: { synced: number; errors: number };
}> {
  logger.info("Running WeChat notification check (birthday + events)...");
  const result: {
    sent: number; skipped: number; errors: number;
    errorSamples: Array<{ label: string; errcode?: number; errmsg?: string }>;
    syncResult?: { synced: number; errors: number };
  } = { sent: 0, skipped: 0, errors: 0, errorSamples: [] };

  const config = await getNotifyConfig();

  // Ensure default template ID is persisted if DB has nothing
  if (!(await getSettingLocal("notify_template_id"))) {
    await setSettingLocal("notify_template_id", DEFAULT_TEMPLATE_ID);
  }

  const templateId = config.templateId || DEFAULT_TEMPLATE_ID;

  if (!config.enabled) {
    logger.info("WeChat notifications disabled, skipping");
    await setSettingLocal("notify_mp_last_run",    new Date().toISOString());
    await setSettingLocal("notify_mp_last_result", JSON.stringify(result));
    return result;
  }

  const token = await getAccessToken();
  if (!token) {
    logger.error("Cannot run WeChat notifications: failed to obtain access token");
    result.errors = 1;
    await setSettingLocal("notify_mp_last_run",    new Date().toISOString());
    await setSettingLocal("notify_mp_last_result", JSON.stringify(result));
    return result;
  }

  // ── 发送前先同步 OA 关注者 → oaOpenId（利用 unionId 匹配）────────────────────
  // 确保历史关注者和新关注者都能收到消息，无需重新关注触发 webhook
  try {
    const syncResult = await syncOaOpenIds(token);
    result.syncResult = syncResult;
    if (syncResult.synced > 0) {
      logger.info({ synced: syncResult.synced }, "Pre-notification OA sync completed");
    }
  } catch (err) {
    logger.error({ err }, "Pre-notification OA sync failed (will still attempt sending)");
  }

  // 查询所有有 oaOpenId 的用户（含纯 OA 关注者 + H5 OA 登录用户）
  const users = await db.select().from(usersTable).where(
    isNotNull(usersTable.oaOpenId)
  );

  logger.info({ userCount: users.length }, "WeChat notification: real users with oaOpenId");

  for (const user of users) {
    try {
      const items = await buildItems(user.id, user.oaOpenId!, config.daysBefore);

      if (items.length === 0) {
        result.skipped++;
        continue;
      }

      for (const item of items) {
        try {
          const { ok, errcode, errmsg } = await sendTemplateMsg(token, templateId, item);
          if (ok) {
            result.sent++;
          } else {
            result.errors++;
            // 保留前 5 条错误样本，供管理员诊断
            if (result.errorSamples.length < 5) {
              result.errorSamples.push({ label: item.label, errcode, errmsg });
            }
            logger.error({ errcode, errmsg, label: item.label, userId: user.id },
              "WeChat template send failed");
          }
        } catch (err) {
          result.errors++;
          logger.error({ err, label: item.label }, "Error sending WeChat notification item");
        }
      }
    } catch (err) {
      result.errors++;
      logger.error({ err, userId: user.id }, "Error building notification items for user");
    }
  }

  await setSettingLocal("notify_mp_last_run",    new Date().toISOString());
  await setSettingLocal("notify_mp_last_result", JSON.stringify({
    sent:         result.sent,
    skipped:      result.skipped,
    errors:       result.errors,
    errorSamples: result.errorSamples.slice(0, 5),
  }));
  logger.info({ sent: result.sent, skipped: result.skipped, errors: result.errors }, "WeChat notification check complete");
  return result;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
export function scheduleWechatNotifications(): void {
  logger.info("Scheduling WeChat birthday notifications");

  async function getNextDelay(): Promise<number> {
    const config = await getNotifyConfig();
    const now    = new Date();
    const target = new Date();
    target.setHours(config.sendHour, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return target.getTime() - now.getTime();
  }

  async function scheduleNext(): Promise<void> {
    const delay   = await getNextDelay();
    const nextRun = new Date(Date.now() + delay);
    logger.info({ nextRun: nextRun.toISOString() }, "Next WeChat notification run scheduled");
    setTimeout(async () => {
      await runWechatBirthdayNotifications();
      await scheduleNext();
    }, delay);
  }

  scheduleNext();
}
