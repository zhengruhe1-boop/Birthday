import { db, contactsTable, usersTable, settingsTable } from "@workspace/db";
import { isNotNull, eq, and, not, like } from "drizzle-orm";
import { calcDaysUntilBirthday, formatBirthdayDisplay } from "./birthday.js";
import { logger } from "./logger.js";

// ── In-memory access token cache ──────────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

// ── DB helpers (local copy to avoid circular import with admin.ts) ────────────
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
async function getAccessToken(): Promise<string | null> {
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
  enabled:        boolean;
  daysBefore:     number[];
  sendHour:       number;
  templateId:     string;
  varName:        string;
  varDate:        string;
  varDays:        string;
  lastRunAt:      string | null;
  lastRunResult:  { sent: number; skipped: number; errors: number } | null;
}

export async function getNotifyConfig(): Promise<NotifyConfig> {
  const [enabled, daysBefore, sendHour, templateId, varName, varDate, varDays, lastRunAt, lastResult] =
    await Promise.all([
      getSettingLocal("notify_enabled"),
      getSettingLocal("notify_days_before"),
      getSettingLocal("notify_send_hour"),
      getSettingLocal("notify_template_id"),
      getSettingLocal("notify_var_name"),
      getSettingLocal("notify_var_date"),
      getSettingLocal("notify_var_days"),
      getSettingLocal("notify_mp_last_run"),
      getSettingLocal("notify_mp_last_result"),
    ]);

  return {
    enabled:       enabled === "true",
    daysBefore:    daysBefore ? daysBefore.split(",").map(Number).filter(n => !isNaN(n)) : [1],
    sendHour:      sendHour ? parseInt(sendHour, 10) : 8,
    templateId:    templateId ?? "",
    varName:       varName ?? "keyword1",
    varDate:       varDate ?? "keyword2",
    varDays:       varDays ?? "keyword3",
    lastRunAt,
    lastRunResult: lastResult ? JSON.parse(lastResult) : null,
  };
}

// ── Main notification runner ──────────────────────────────────────────────────
export async function runWechatBirthdayNotifications(): Promise<{ sent: number; skipped: number; errors: number }> {
  logger.info("Running WeChat birthday notification check...");
  const result = { sent: 0, skipped: 0, errors: 0 };

  const config = await getNotifyConfig();
  if (!config.enabled || !config.templateId) {
    logger.info("WeChat notifications disabled or no template configured, skipping");
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
    const contacts = await db.select().from(contactsTable)
      .where(eq(contactsTable.userId, user.id));

    for (const contact of contacts) {
      try {
        const daysUntil = calcDaysUntilBirthday(contact.birthdayMonth, contact.birthdayDay);
        if (!config.daysBefore.includes(daysUntil)) {
          result.skipped++;
          continue;
        }

        const dateDisplay = formatBirthdayDisplay(contact.birthdayMonth, contact.birthdayDay, contact.birthdayLunar);
        const daysText    = daysUntil === 0 ? "今天就是Ta的生日 🎂" : `还有 ${daysUntil} 天就是Ta的生日`;

        const payload = {
          touser:      user.openId!,
          template_id: config.templateId,
          data: {
            [config.varName]: { value: contact.name,  color: "#173177" },
            [config.varDate]: { value: dateDisplay,   color: "#173177" },
            [config.varDays]: { value: daysText,      color: "#FF5B5B" },
          },
        };

        const msgRes = await fetch(
          `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        );
        const msgData = await msgRes.json() as { errcode?: number; errmsg?: string };

        if (msgData.errcode === 0 || msgData.errmsg === "ok") {
          result.sent++;
          logger.info({ contactId: contact.id, name: contact.name, userId: user.id, daysUntil }, "WeChat birthday notification sent");
        } else {
          result.errors++;
          logger.error({ msgData, contactId: contact.id, userId: user.id }, "Failed to send WeChat template message");
        }
      } catch (err) {
        result.errors++;
        logger.error({ err, contactId: contact.id }, "Error sending WeChat notification");
      }
    }
  }

  await setSettingLocal("notify_mp_last_run",    new Date().toISOString());
  await setSettingLocal("notify_mp_last_result", JSON.stringify(result));
  logger.info(result, "WeChat birthday notification check complete");
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
