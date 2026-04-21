import { db, contactsTable, settingsTable } from "@workspace/db";
import { eq, isNotNull } from "drizzle-orm";
import { sendBirthdayReminder, getEmailConfig } from "./email.js";
import { calcDaysUntilBirthday, formatBirthdayDisplay } from "./birthday.js";
import { logger } from "./logger.js";

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
        id:            contactsTable.id,
        name:          contactsTable.name,
        birthdayMonth: contactsTable.birthdayMonth,
        birthdayDay:   contactsTable.birthdayDay,
        birthdayLunar: contactsTable.birthdayLunar,
        birthYear:     contactsTable.birthYear,
        relation:      contactsTable.relation,
        reminderEmail: contactsTable.reminderEmail,
      })
      .from(contactsTable)
      .where(isNotNull(contactsTable.reminderEmail));

    logger.info({ count: contacts.length }, "Contacts with reminder emails found");

    for (const contact of contacts) {
      try {
        const daysUntil = calcDaysUntilBirthday(contact.birthdayMonth, contact.birthdayDay, contact.birthYear ?? undefined, contact.birthdayLunar);
        if (!cfg.daysBefore.includes(daysUntil)) continue;

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
