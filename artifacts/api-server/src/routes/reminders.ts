import { Router, type IRouter } from "express";
import { runBirthdayReminders } from "../lib/reminder.js";
import { verifyEmailConfig, sendBirthdayReminder } from "../lib/email.js";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { db, contactsTable, settingsTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { calcDaysUntilBirthday } from "../lib/birthday.js";

async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

const router: IRouter = Router();

router.use(requireAuth);

// ── GET /api/reminders/defaults ──────────────────────────────────────────────
// Returns admin-configured defaults for the miniprogram reminder UI
router.get("/defaults", async (req: AuthRequest, res) => {
  try {
    const [mpDays, mpHour] = await Promise.all([
      getSetting("mp_notify_days_before"),
      getSetting("mp_notify_send_hour"),
    ]);
    res.json({
      mpDaysBefore: mpDays ? mpDays.split(",").map(Number).filter(n => !isNaN(n)) : [0, 1],
      mpSendHour:   mpHour ? parseInt(mpHour, 10) : 8,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get reminder defaults");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Manual trigger: send reminders for all contacts with reminder email (for testing)
router.post("/trigger", async (req: AuthRequest, res) => {
  try {
    const result = await runBirthdayReminders();
    res.json({ success: true, ...result });
  } catch (err) {
    req.log.error({ err }, "Failed to trigger reminders");
    res.status(500).json({ error: "Failed to trigger reminders" });
  }
});

// Send a test reminder for a specific contact
router.post("/test/:contactId", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const contactId = parseInt(req.params.contactId);

    if (isNaN(contactId)) {
      res.status(400).json({ error: "Invalid contact ID" });
      return;
    }

    const contacts = await db.select().from(contactsTable)
      .where(and(eq(contactsTable.id, contactId), eq(contactsTable.userId, userId)))
      .limit(1);

    if (contacts.length === 0) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }

    const contact = contacts[0];
    if (!contact.reminderEmail) {
      res.status(400).json({ error: "Contact has no reminder email set" });
      return;
    }

    const daysUntil = calcDaysUntilBirthday(contact.birthdayMonth, contact.birthdayDay);
    const today = new Date();
    const age = contact.birthYear ? today.getFullYear() - contact.birthYear : null;

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
      toEmail: contact.reminderEmail,
      contactName: contact.name,
      birthdayDisplay,
      daysUntil,
      age,
      relation: contact.relation,
    });

    res.json({
      success: true,
      message: `测试提醒邮件已发送至 ${contact.reminderEmail}`,
      contact: contact.name,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to send test reminder");
    res.status(500).json({ error: "发送测试邮件失败，请检查邮箱配置" });
  }
});

// Verify email configuration
router.get("/verify-email", async (req: AuthRequest, res) => {
  try {
    const ok = await verifyEmailConfig();
    res.json({ ok, message: ok ? "邮箱配置正常" : "邮箱配置有误，请检查授权码" });
  } catch (err) {
    req.log.error({ err }, "Email verification failed");
    res.status(500).json({ error: "邮箱验证失败" });
  }
});

export default router;
