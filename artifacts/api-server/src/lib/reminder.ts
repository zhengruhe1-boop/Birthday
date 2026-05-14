import { db, contactsTable, eventsTable, timeCapsulesTable, settingsTable } from "@workspace/db";
import { eq, isNotNull, and } from "drizzle-orm";
import { sendBirthdayReminder, sendEventReminder, sendCapsuleReminder, getEmailConfig } from "./email.js";
import { calcDaysUntilBirthday, formatBirthdayDisplay } from "./birthday.js";
import { logger } from "./logger.js";

// ── Date helpers (local) ──────────────────────────────────────────────────────
function daysUntilDateLocal(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr + "T00:00:00").getTime() - today.getTime()) / 86400000);
}

function daysUntilAnniversaryLocal(dateStr: string): { days: number; display: string } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  const thisYr = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (thisYr < today) thisYr.setFullYear(today.getFullYear() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    days:    Math.round((thisYr.getTime() - today.getTime()) / 86400000),
    display: `${p(thisYr.getMonth() + 1)}月${p(thisYr.getDate())}日`,
  };
}

// ── Local settings helper ─────────────────────────────────────────────────────
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

// ── Runner ────────────────────────────────────────────────────────────────────
export async function runBirthdayReminders(): Promise<{ sent: number; errors: number }> {
  logger.info("Running birthday reminder check...");
  const result = { sent: 0, errors: 0 };

  const cfg = await getEmailConfig();
  if (!cfg.enabled) {
    logger.info("Email reminders disabled, skipping");
    await setSettingLocal("email_last_run",    new Date().toISOString());
    await setSettingLocal("email_last_result", JSON.stringify(result));
    return result;
  }

  try {
    const contacts = await db
      .select({
        id:                 contactsTable.id,
        name:               contactsTable.name,
        birthdayMonth:      contactsTable.birthdayMonth,
        birthdayDay:        contactsTable.birthdayDay,
        birthdayLunar:      contactsTable.birthdayLunar,
        birthYear:          contactsTable.birthYear,
        relation:           contactsTable.relation,
        reminderEmail:      contactsTable.reminderEmail,
        reminderDaysBefore: contactsTable.reminderDaysBefore,
      })
      .from(contactsTable)
      .where(isNotNull(contactsTable.reminderEmail));

    logger.info({ count: contacts.length }, "Contacts with reminder emails found");

    for (const contact of contacts) {
      try {
        const daysUntil = calcDaysUntilBirthday(contact.birthdayMonth, contact.birthdayDay, contact.birthYear ?? undefined, contact.birthdayLunar);
        const effectiveDays = (contact as Record<string, unknown>).reminderDaysBefore
          ? String((contact as Record<string, unknown>).reminderDaysBefore).split(",").map(Number).filter(n => !isNaN(n))
          : cfg.daysBefore;
        if (!effectiveDays.includes(daysUntil)) continue;

        const birthdayDisplay = formatBirthdayDisplay(contact.birthdayMonth, contact.birthdayDay, contact.birthdayLunar);
        const today = new Date();
        const age   = contact.birthYear ? today.getFullYear() - contact.birthYear : null;

        await sendBirthdayReminder({
          toEmail:         contact.reminderEmail!,
          contactName:     contact.name,
          birthdayDisplay,
          daysUntil,
          age,
          relation:        contact.relation,
        });

        result.sent++;
        logger.info(
          { contactId: contact.id, name: contact.name, toEmail: contact.reminderEmail, daysUntil },
          "Birthday reminder sent",
        );
      } catch (err) {
        result.errors++;
        logger.error({ err, contactId: contact.id, name: contact.name }, "Failed to send birthday reminder");
      }
    }
  } catch (err) {
    result.errors++;
    logger.error({ err }, "Failed to run birthday reminders");
  }

  // ── Events（纪念日 / 倒数日 / 其它提醒）─────────────────────────────────────
  try {
    const events = await db.select().from(eventsTable).where(isNotNull(eventsTable.reminderEmail));
    logger.info({ count: events.length }, "Events with reminder emails found");

    for (const e of events) {
      try {
        const evtEffDays = e.reminderDaysBefore
          ? e.reminderDaysBefore.split(",").map(Number).filter(n => !isNaN(n))
          : cfg.daysBefore;

        let daysUntil: number | null = null;
        let dateDisplay = "";
        let eventType: "anniversary" | "countdown" | "other" = "other";

        if (e.type === "anniversary" && e.eventDate) {
          eventType = "anniversary";
          const r = daysUntilAnniversaryLocal(e.eventDate);
          daysUntil = r.days; dateDisplay = r.display;
        } else if (e.type === "countdown" && e.eventDate) {
          eventType = "countdown";
          daysUntil = daysUntilDateLocal(e.eventDate);
          const d = new Date(e.eventDate + "T00:00:00");
          const p = (n: number) => String(n).padStart(2, "0");
          dateDisplay = `${p(d.getMonth() + 1)}月${p(d.getDate())}日`;
        } else if (e.type === "other" && e.reminderTime) {
          eventType = "other";
          daysUntil = daysUntilDateLocal(e.reminderTime.slice(0, 10));
          const d = new Date(e.reminderTime.slice(0, 10) + "T00:00:00");
          const p = (n: number) => String(n).padStart(2, "0");
          dateDisplay = `${p(d.getMonth() + 1)}月${p(d.getDate())}日 ${e.reminderTime.slice(11, 16)}`;
        }

        if (daysUntil === null || !evtEffDays.includes(daysUntil)) continue;

        await sendEventReminder({
          toEmail:     e.reminderEmail!,
          eventName:   e.name,
          eventType,
          dateDisplay,
          daysUntil,
          person:      e.person,
        });
        result.sent++;
        logger.info({ eventId: e.id, name: e.name, type: e.type, daysUntil }, "Event reminder sent");
      } catch (err) {
        result.errors++;
        logger.error({ err, eventId: e.id }, "Failed to send event reminder");
      }
    }
  } catch (err) {
    result.errors++;
    logger.error({ err }, "Failed to run event reminders");
  }

  // ── Time capsules ────────────────────────────────────────────────────────────
  try {
    const capsules = await db.select().from(timeCapsulesTable)
      .where(and(isNotNull(timeCapsulesTable.reminderEmail), eq(timeCapsulesTable.notifyEnabled, true)));
    logger.info({ count: capsules.length }, "Capsules with reminder emails found");

    for (const cap of capsules) {
      try {
        const daysUntil = daysUntilDateLocal(cap.openAt.slice(0, 10));
        if (!cfg.daysBefore.includes(daysUntil)) continue;
        const title = cap.title || cap.message.slice(0, 10) + (cap.message.length > 10 ? "…" : "");
        await sendCapsuleReminder({ toEmail: cap.reminderEmail!, title, openAt: cap.openAt, daysUntil });
        result.sent++;
        logger.info({ capsuleId: cap.id, title, daysUntil }, "Capsule reminder sent");
      } catch (err) {
        result.errors++;
        logger.error({ err, capsuleId: cap.id }, "Failed to send capsule reminder");
      }
    }
  } catch (err) {
    result.errors++;
    logger.error({ err }, "Failed to run capsule reminders");
  }

  await setSettingLocal("email_last_run",    new Date().toISOString());
  await setSettingLocal("email_last_result", JSON.stringify(result));
  logger.info(result, "Birthday reminder check complete");
  return result;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
export function scheduleDailyReminders(): void {
  logger.info("Scheduling daily birthday reminders");

  async function getNextDelay(): Promise<number> {
    const sendHour = parseInt((await getSettingLocal("email_send_hour")) ?? "8", 10) || 8;
    const now    = new Date();
    const target = new Date();
    target.setHours(sendHour, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    return target.getTime() - now.getTime();
  }

  async function scheduleNext(): Promise<void> {
    const delay   = await getNextDelay();
    const nextRun = new Date(Date.now() + delay);
    logger.info({ nextRun: nextRun.toISOString() }, "Next birthday reminder run scheduled");
    setTimeout(async () => {
      await runBirthdayReminders();
      await scheduleNext();
    }, delay);
  }

  scheduleNext();
}
