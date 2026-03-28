import { db, contactsTable, usersTable } from "@workspace/db";
import { eq, isNotNull, and } from "drizzle-orm";
import { sendBirthdayReminder } from "./email.js";
import { calcDaysUntilBirthday } from "./birthday.js";
import { logger } from "./logger.js";

export async function runBirthdayReminders(): Promise<{ sent: number; errors: number }> {
  logger.info("Running birthday reminder check...");
  let sent = 0;
  let errors = 0;

  try {
    // Get all contacts that have a reminder email set
    const contacts = await db
      .select({
        id: contactsTable.id,
        name: contactsTable.name,
        birthdayMonth: contactsTable.birthdayMonth,
        birthdayDay: contactsTable.birthdayDay,
        birthdayLunar: contactsTable.birthdayLunar,
        birthYear: contactsTable.birthYear,
        relation: contactsTable.relation,
        reminderEmail: contactsTable.reminderEmail,
      })
      .from(contactsTable)
      .where(isNotNull(contactsTable.reminderEmail));

    logger.info({ count: contacts.length }, "Contacts with reminder emails found");

    for (const contact of contacts) {
      try {
        const daysUntil = calcDaysUntilBirthday(contact.birthdayMonth, contact.birthdayDay);

        // Send reminder 1 day before (daysUntil === 1) or on the day (daysUntil === 0)
        if (daysUntil === 1 || daysUntil === 0) {
          const today = new Date();
          const age = contact.birthYear ? today.getFullYear() - contact.birthYear : null;

          // Format birthday display
          const LUNAR_MONTHS = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
          const LUNAR_DAYS_1_10 = ["初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十"];
          const LUNAR_DAYS_11_20 = ["十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十"];
          const LUNAR_DAYS_21_30 = ["廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];

          let birthdayDisplay: string;
          if (contact.birthdayLunar) {
            const monthStr = LUNAR_MONTHS[contact.birthdayMonth - 1] + "月";
            let dayStr = "";
            if (contact.birthdayDay <= 10) dayStr = LUNAR_DAYS_1_10[contact.birthdayDay - 1];
            else if (contact.birthdayDay <= 20) dayStr = LUNAR_DAYS_11_20[contact.birthdayDay - 11];
            else dayStr = LUNAR_DAYS_21_30[contact.birthdayDay - 21];
            birthdayDisplay = monthStr + dayStr;
          } else {
            birthdayDisplay = `${contact.birthdayMonth}月${contact.birthdayDay}日`;
          }

          await sendBirthdayReminder({
            toEmail: contact.reminderEmail!,
            contactName: contact.name,
            birthdayDisplay,
            daysUntil,
            age,
            relation: contact.relation,
          });

          sent++;
          logger.info(
            { contactId: contact.id, name: contact.name, toEmail: contact.reminderEmail, daysUntil },
            "Birthday reminder sent"
          );
        }
      } catch (err) {
        errors++;
        logger.error({ err, contactId: contact.id, name: contact.name }, "Failed to send birthday reminder");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to run birthday reminders");
  }

  logger.info({ sent, errors }, "Birthday reminder check complete");
  return { sent, errors };
}

// Schedule daily reminders at 8:00 AM
export function scheduleDailyReminders(): void {
  logger.info("Scheduling daily birthday reminders");

  function getNextRunDelay(): number {
    const now = new Date();
    const target = new Date();
    target.setHours(8, 0, 0, 0);

    // If 8 AM already passed today, schedule for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    return target.getTime() - now.getTime();
  }

  function scheduleNext(): void {
    const delay = getNextRunDelay();
    const nextRun = new Date(Date.now() + delay);
    logger.info({ nextRun: nextRun.toISOString() }, "Next birthday reminder run scheduled");

    setTimeout(async () => {
      await runBirthdayReminders();
      scheduleNext(); // reschedule for next day
    }, delay);
  }

  scheduleNext();
}
