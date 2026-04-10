import { db, contactsTable, usersTable, settingsTable, eventsTable } from "@workspace/db";
import { isNotNull, eq, and, not, like } from "drizzle-orm";
import { calcDaysUntilBirthday, formatBirthdayDisplay } from "./birthday.js";
import { logger } from "./logger.js";

// ── Fixed template variable keys (must match the WeChat template) ─────────────
const TMPL_VAR_NAME = "thing19";   // 姓名 + 事件类型，e.g. "张三 · 生日"
const TMPL_VAR_TIME = "time24";    // 事件日期时间，e.g. "2026-04-10 08:00"

// ── User's actual template ID (hard-coded as default) ─────────────────────────
const DEFAULT_TEMPLATE_ID = "iKiueM36DMAWXrO4VQMK68ulAFDz_51ylIBZt_AMw9w";

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
  lastRunAt:     string | null;
  lastRunResult: { sent: number; skipped: number; errors: number } | null;
}

export async function getNotifyConfig(): Promise<NotifyConfig> {
  const [enabled, daysBefore, sendHour, templateId, lastRunAt, lastResult] =
    await Promise.all([
      getSettingLocal("notify_enabled"),
      getSettingLocal("notify_days_before"),
      getSettingLocal("notify_send_hour"),
      getSettingLocal("notify_template_id"),
      getSettingLocal("notify_mp_last_run"),
      getSettingLocal("notify_mp_last_result"),
    ]);

  return {
    enabled:       enabled === "true",
    daysBefore:    daysBefore ? daysBefore.split(",").map(Number).filter(n => !isNaN(n)) : [1],
    sendHour:      sendHour ? parseInt(sendHour, 10) : 8,
    templateId:    templateId ?? DEFAULT_TEMPLATE_ID,
    lastRunAt,
    lastRunResult: lastResult ? JSON.parse(lastResult) : null,
  };
}

// ── Format helpers ────────────────────────────────────────────────────────────
function toDateTimeStr(dateStr: string, hour = 8): string {
  // dateStr is YYYY-MM-DD; return "YYYY-MM-DD HH:mm"
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dateStr} ${pad(hour)}:00`;
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
  nameField: string;   // thing19 value
  timeField: string;   // time24 value
  label:     string;   // for logging
}

// ── Send single template message ──────────────────────────────────────────────
async function sendTemplateMsg(
  token: string,
  templateId: string,
  item: NotifyItem,
): Promise<boolean> {
  const payload = {
    touser:      item.openId,
    template_id: templateId,
    data: {
      [TMPL_VAR_NAME]: { value: item.nameField },
      [TMPL_VAR_TIME]: { value: item.timeField },
    },
  };

  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
  );
  const data = await res.json() as { errcode?: number; errmsg?: string };
  if (data.errcode === 0 || data.errmsg === "ok") {
    logger.info({ label: item.label, openId: item.openId }, "WeChat template message sent");
    return true;
  }
  logger.error({ data, label: item.label, openId: item.openId }, "Failed to send WeChat template message");
  return false;
}

// ── Build notification items for a user ──────────────────────────────────────
async function buildItems(
  userId: number,
  openId: string,
  daysBefore: number[],
): Promise<NotifyItem[]> {
  const items: NotifyItem[] = [];

  // ── 1. Contacts → 生日 ──────────────────────────────────────────────────────
  const contacts = await db.select().from(contactsTable).where(eq(contactsTable.userId, userId));

  for (const c of contacts) {
    const days = calcDaysUntilBirthday(c.birthdayMonth, c.birthdayDay);
    if (!daysBefore.includes(days)) continue;
    const dateStr = thisYearDate(c.birthdayMonth, c.birthdayDay);
    items.push({
      openId,
      nameField: `${c.name} · 生日`,
      timeField: toDateTimeStr(dateStr),
      label:     `contact:${c.id} 生日`,
    });
  }

  // ── 2. Events ───────────────────────────────────────────────────────────────
  const events = await db.select().from(eventsTable).where(eq(eventsTable.userId, userId));

  for (const e of events) {
    if (e.type === "anniversary" && e.eventDate) {
      const { days, targetDate } = daysUntilAnniversary(e.eventDate);
      if (!daysBefore.includes(days)) continue;
      items.push({
        openId,
        nameField: `${e.name}${e.person ? ` (${e.person})` : ""} · 纪念日`,
        timeField: toDateTimeStr(targetDate),
        label:     `event:${e.id} 纪念日`,
      });
    } else if (e.type === "countdown" && e.eventDate) {
      const days = daysUntilDate(e.eventDate);
      if (!daysBefore.includes(days)) continue;
      items.push({
        openId,
        nameField: `${e.name} · 倒数日`,
        timeField: toDateTimeStr(e.eventDate),
        label:     `event:${e.id} 倒数日`,
      });
    } else if (e.type === "other" && e.reminderTime) {
      // reminderTime is "YYYY-MM-DD HH:mm" or "YYYY-MM-DDTHH:mm"
      const dateStr = e.reminderTime.replace("T", " ").slice(0, 10);
      const days    = daysUntilDate(dateStr);
      if (!daysBefore.includes(days)) continue;
      const timeValue = e.reminderTime.replace("T", " ").slice(0, 16);
      items.push({
        openId,
        nameField: `${e.name} · 其它`,
        timeField: timeValue,
        label:     `event:${e.id} 其它`,
      });
    }
  }

  return items;
}

// ── Main notification runner ──────────────────────────────────────────────────
export async function runWechatBirthdayNotifications(): Promise<{ sent: number; skipped: number; errors: number }> {
  logger.info("Running WeChat notification check (birthday + events)...");
  const result = { sent: 0, skipped: 0, errors: 0 };

  const config = await getNotifyConfig();

  // Ensure default template ID is persisted if DB has nothing
  const storedId = await getSettingLocal("notify_template_id");
  if (!storedId) {
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

  // Only real WeChat users (openId exists and is not a mock)
  const users = await db.select().from(usersTable)
    .where(and(isNotNull(usersTable.openId), not(like(usersTable.openId, "mock:%"))));

  for (const user of users) {
    try {
      const items = await buildItems(user.id, user.openId!, config.daysBefore);

      if (items.length === 0) {
        result.skipped++;
        continue;
      }

      for (const item of items) {
        try {
          const ok = await sendTemplateMsg(token, templateId, item);
          if (ok) result.sent++;
          else    result.errors++;
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
  await setSettingLocal("notify_mp_last_result", JSON.stringify(result));
  logger.info(result, "WeChat notification check complete");
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
