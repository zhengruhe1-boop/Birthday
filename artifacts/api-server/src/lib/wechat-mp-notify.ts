import { db, contactsTable, usersTable, settingsTable, eventsTable } from "@workspace/db";
import { isNotNull, eq, and, not, like } from "drizzle-orm";
import { calcDaysUntilBirthday } from "./birthday.js";
import { logger } from "./logger.js";

const DEFAULT_MP_TEMPLATE_ID = "vpfpK6EUtYVem_oGGaweNmz7C3uQ_9oaG9dbh2H81oQ";

let cachedMpToken: { token: string; expiresAt: number } | null = null;

async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  if (existing.length > 0) {
    await db.update(settingsTable).set({ value, updatedAt: new Date() }).where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({ key, value });
  }
}

export async function getMpAccessToken(): Promise<string | null> {
  if (cachedMpToken && cachedMpToken.expiresAt > Date.now() + 60_000) {
    return cachedMpToken.token;
  }

  const appId     = await getSetting("wechat_mp_appid");
  const appSecret = await getSetting("wechat_mp_appsecret");
  if (!appId || !appSecret) return null;

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appId)}&secret=${encodeURIComponent(appSecret)}`;
  let data: { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string };
  try {
    const res = await fetch(url);
    data = await res.json();
  } catch (err) {
    logger.error({ err }, "Network error fetching MP access token");
    return null;
  }

  if (!data.access_token) {
    logger.error({ errcode: data.errcode, errmsg: data.errmsg }, "Failed to get MP access token");
    return null;
  }

  cachedMpToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000 };
  return cachedMpToken.token;
}

export interface MpNotifyConfig {
  enabled:        boolean;
  templateId:     string;
  daysBefore:     number[];
  sendHour:       number;
  tipText:        string;
  lastRunAt:      string | null;
  lastRunResult:  { sent: number; skipped: number; errors: number } | null;
}

export async function getMpNotifyConfig(): Promise<MpNotifyConfig> {
  const [enabled, templateId, daysBefore, sendHour, tipText, lastRunAt, lastResult] = await Promise.all([
    getSetting("mp_notify_enabled"),
    getSetting("mp_notify_template_id"),
    getSetting("mp_notify_days_before"),
    getSetting("mp_notify_send_hour"),
    getSetting("mp_notify_tip_text"),
    getSetting("mp_notify_last_run"),
    getSetting("mp_notify_last_result"),
  ]);

  return {
    enabled:       enabled !== "false",   // 未配置时默认开启
    templateId:    templateId ?? DEFAULT_MP_TEMPLATE_ID,
    daysBefore:    daysBefore ? daysBefore.split(",").map(Number).filter(n => !isNaN(n)) : [0, 1],  // 默认当天+提前1天
    sendHour:      sendHour ? parseInt(sendHour, 10) : 8,
    tipText:       tipText ?? "Ta的生日快到了，记得送上生日祝福！",
    lastRunAt:     lastRunAt ?? null,
    lastRunResult: lastResult ? JSON.parse(lastResult) : null,
  };
}

async function sendSubscribeMessage(
  token: string,
  templateId: string,
  openid: string,
  name: string,
  dateStr: string,
  tip: string
): Promise<{ ok: boolean; errcode?: number; errmsg?: string }> {
  const trunc = (s: string, max: number) => s.length > max ? s.slice(0, max) : s;

  const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`;
  const body = {
    touser:          openid,
    template_id:     templateId,
    page:            "pages/home/home",
    miniprogram_state: "formal",
    lang:            "zh_CN",
    data: {
      name1:  { value: trunc(name, 20) },
      thing6: { value: trunc(dateStr, 20) },
      thing5: { value: trunc(tip, 20) },
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result: { errcode: number; errmsg: string } = await res.json();
    return { ok: result.errcode === 0, errcode: result.errcode, errmsg: result.errmsg };
  } catch (err) {
    logger.error({ err }, "Network error sending MP subscribe message");
    return { ok: false };
  }
}

function thisYearDate(month: number, day: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(month)}月${pad(day)}日`;
}

function daysUntilDate(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function daysUntilAnniversary(dateStr: string): { days: number; dateDisplay: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  const thisYr = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (thisYr < today) thisYr.setFullYear(today.getFullYear() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = Math.round((thisYr.getTime() - today.getTime()) / 86400000);
  return {
    days,
    dateDisplay: `${pad(thisYr.getMonth() + 1)}月${pad(thisYr.getDate())}日`,
  };
}

interface NotifyItem {
  openId:      string;
  name:        string;
  dateDisplay: string;
  label:       string;
}

async function buildMpItems(userId: number, openId: string, daysBefore: number[]): Promise<NotifyItem[]> {
  const items: NotifyItem[] = [];

  const contacts = await db.select().from(contactsTable).where(eq(contactsTable.userId, userId));
  for (const c of contacts) {
    const days = calcDaysUntilBirthday(
      c.birthdayMonth,
      c.birthdayDay,
      c.birthYear ?? undefined,
      c.birthdayLunar ?? false
    );
    const effectiveDays = c.reminderDaysBefore
      ? c.reminderDaysBefore.split(",").map(Number).filter(n => !isNaN(n))
      : daysBefore;
    if (!effectiveDays.includes(days)) continue;
    const dateDisplay = thisYearDate(c.birthdayMonth, c.birthdayDay);
    items.push({ openId, name: c.name, dateDisplay, label: `contact:${c.id}` });
  }

  const events = await db.select().from(eventsTable).where(eq(eventsTable.userId, userId));
  for (const e of events) {
    const evtEffDays = e.reminderDaysBefore
      ? e.reminderDaysBefore.split(",").map(Number).filter(n => !isNaN(n))
      : daysBefore;
    if (e.type === "anniversary" && e.eventDate) {
      const { days, dateDisplay } = daysUntilAnniversary(e.eventDate);
      if (!evtEffDays.includes(days)) continue;
      items.push({ openId, name: e.name, dateDisplay, label: `event:${e.id}` });
    } else if (e.type === "countdown" && e.eventDate) {
      const days = daysUntilDate(e.eventDate);
      if (!evtEffDays.includes(days)) continue;
      const d = new Date(e.eventDate + "T00:00:00");
      const dateDisplay = `${String(d.getMonth() + 1).padStart(2, "0")}月${String(d.getDate()).padStart(2, "0")}日`;
      items.push({ openId, name: e.name, dateDisplay, label: `event:${e.id}` });
    }
  }

  return items;
}

export async function runMpBirthdayNotifications(): Promise<{ sent: number; skipped: number; errors: number }> {
  logger.info("Running MP subscribe notification check...");
  const result = { sent: 0, skipped: 0, errors: 0 };

  const config = await getMpNotifyConfig();

  if (!config.enabled) {
    logger.info("MP subscribe notifications disabled, skipping");
    await setSetting("mp_notify_last_run",    new Date().toISOString());
    await setSetting("mp_notify_last_result", JSON.stringify(result));
    return result;
  }

  const token = await getMpAccessToken();
  if (!token) {
    logger.error("Cannot run MP notifications: failed to obtain MP access token");
    result.errors = 1;
    await setSetting("mp_notify_last_run",    new Date().toISOString());
    await setSetting("mp_notify_last_result", JSON.stringify(result));
    return result;
  }

  const users = await db.select().from(usersTable).where(
    and(
      isNotNull(usersTable.openId),
      not(like(usersTable.openId, "mock:%")),
      eq(usersTable.mpSubscribed, true)
    )
  );

  for (const user of users) {
    try {
      const items = await buildMpItems(user.id, user.openId!, config.daysBefore);

      if (items.length === 0) {
        result.skipped++;
        continue;
      }

      let sentForUser = 0;
      for (const item of items) {
        if (user.mpSubscribeCount <= 0) break;

        const res = await sendSubscribeMessage(
          token,
          config.templateId,
          item.openId,
          item.name,
          item.dateDisplay,
          config.tipText
        );

        if (res.ok) {
          result.sent++;
          sentForUser++;
          const newCount = Math.max(0, user.mpSubscribeCount - 1);
          await db.update(usersTable).set({
            mpSubscribeCount: newCount,
            mpSubscribed:     newCount > 0,
          }).where(eq(usersTable.id, user.id));
          user.mpSubscribeCount = newCount;
        } else {
          if (res.errcode === 43101) {
            logger.warn({ userId: user.id }, "MP user not subscribed (43101), clearing flag");
            await db.update(usersTable).set({ mpSubscribed: false, mpSubscribeCount: 0 })
              .where(eq(usersTable.id, user.id));
            break;
          }
          result.errors++;
          logger.error({ res, label: item.label }, "MP subscribe message send failed");
        }
      }

      if (sentForUser === 0 && items.length > 0) result.skipped++;
    } catch (err) {
      result.errors++;
      logger.error({ err, userId: user.id }, "Error processing MP notification for user");
    }
  }

  await setSetting("mp_notify_last_run",    new Date().toISOString());
  await setSetting("mp_notify_last_result", JSON.stringify(result));
  logger.info(result, "MP subscribe notification check complete");
  return result;
}

export function scheduleMpNotifications(): void {
  logger.info("Scheduling MP subscribe birthday notifications");

  async function getNextDelay(): Promise<number> {
    const config = await getMpNotifyConfig();
    const now    = new Date();
    const target = new Date();
    target.setHours(config.sendHour, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return target.getTime() - now.getTime();
  }

  async function schedule() {
    const delay = await getNextDelay();
    logger.info({ nextRun: new Date(Date.now() + delay).toISOString() }, "Next MP notification run scheduled");
    setTimeout(async () => {
      try { await runMpBirthdayNotifications(); } catch (err) { logger.error({ err }, "MP notification run error"); }
      schedule();
    }, delay);
  }

  schedule().catch(err => logger.error({ err }, "Failed to schedule MP notifications"));
}
