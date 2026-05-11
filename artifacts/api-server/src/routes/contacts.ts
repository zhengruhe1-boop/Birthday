import { Router, type IRouter } from "express";
import { db, contactsTable, usersTable, settingsTable } from "@workspace/db";
import { eq, and, asc, like, ne } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { CreateContactBody, UpdateContactBody } from "@workspace/api-zod";
import { formatBirthdayDisplay, calcDaysUntilBirthday, getZodiacName } from "../lib/birthday.js";
import { generateBirthdayEvents, BirthdayEvent } from "../lib/birthday-events.js";
import { sendBirthdayReminder } from "../lib/email.js";

async function getSettingLocal(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

const router: IRouter = Router();

function parseBirthdayEvents(raw: string | null): BirthdayEvent[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function formatContact(c: typeof contactsTable.$inferSelect) {
  const daysUntil = calcDaysUntilBirthday(c.birthdayMonth, c.birthdayDay, c.birthYear ?? undefined, c.birthdayLunar);
  const birthdayDisplay = formatBirthdayDisplay(c.birthdayMonth, c.birthdayDay, c.birthdayLunar);
  const zodiac = getZodiacName(c.birthdayMonth, c.birthdayDay, c.birthdayLunar);

  const today = new Date();
  const age = c.birthYear ? today.getFullYear() - c.birthYear : null;
  
  return {
    id: c.id,
    userId: c.userId,
    name: c.name,
    gender: c.gender,
    birthdayMonth: c.birthdayMonth,
    birthdayDay: c.birthdayDay,
    birthdayLunar: c.birthdayLunar,
    birthYear: c.birthYear,
    relation: c.relation,
    hometown: c.hometown,
    reminderEmail: c.reminderEmail,
    avatarUrl: c.avatarUrl,
    birthdayEvents: parseBirthdayEvents(c.birthdayEvents),
    daysUntilBirthday: daysUntil,
    age,
    birthdayDisplay,
    zodiac,
    hidden: c.hidden ?? false,
    createdAt: c.createdAt,
  };
}

router.use(requireAuth);

// ── GET /api/contacts/hidden ─────────────────────────────────────────────────
router.get("/hidden", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const contacts = await db.select().from(contactsTable)
      .where(and(eq(contactsTable.userId, userId), eq(contactsTable.hidden, true)))
      .orderBy(asc(contactsTable.name));
    res.json(contacts.map(formatContact));
  } catch (err) {
    req.log.error({ err }, "Get hidden contacts error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/upcoming", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const allContacts = await db.select().from(contactsTable)
      .where(and(eq(contactsTable.userId, userId), ne(contactsTable.hidden, true)))
      .orderBy(asc(contactsTable.name));

    const formatted = allContacts.map(formatContact);
    formatted.sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);

    const imminent = formatted.filter(c => c.daysUntilBirthday <= 7);
    const soon = formatted.filter(c => c.daysUntilBirthday > 7 && c.daysUntilBirthday <= 30);
    const monthly = formatted.filter(c => c.daysUntilBirthday > 30);

    res.json({ imminent, soon, monthly });
  } catch (err) {
    req.log.error({ err }, "Get upcoming birthdays error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const search = req.query.search as string | undefined;

    let contacts;
    if (search) {
      contacts = await db.select().from(contactsTable)
        .where(and(eq(contactsTable.userId, userId), ne(contactsTable.hidden, true), like(contactsTable.name, `%${search}%`)))
        .orderBy(asc(contactsTable.name));
    } else {
      contacts = await db.select().from(contactsTable)
        .where(and(eq(contactsTable.userId, userId), ne(contactsTable.hidden, true)))
        .orderBy(asc(contactsTable.name));
    }

    const formatted = contacts.map(formatContact);
    formatted.sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);
    res.json(formatted);
  } catch (err) {
    req.log.error({ err }, "List contacts error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const body = CreateContactBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    // ── 配额检查 ──────────────────────────────────────────────────────────────
    const limitStr = await getSettingLocal("quota_limit");
    const limit = parseInt(limitStr || "0") || 0;
    if (limit > 0) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      const extraQuota = user?.extraQuota ?? 0;
      const allUserContacts = await db.select({ id: contactsTable.id })
        .from(contactsTable).where(eq(contactsTable.userId, userId));
      if (allUserContacts.length >= limit + extraQuota) {
        res.status(403).json({ error: "quota_exceeded", message: "\u5df2\u8fbe\u5230\u6dfb\u52a0\u4e0a\u9650\uff0c\u8bf7\u89e3\u9501\u66f4\u591a\u6b21\u6570" });
        return;
      }
    }

    const inserted = await db.insert(contactsTable).values({
      userId,
      ...body.data,
    }).returning();

    const contact = inserted[0];
    res.status(201).json(formatContact(contact));

    // Generate birthday events in the background (uses birth month+day only now)
    generateBirthdayEvents(contact.birthdayMonth, contact.birthdayDay)
      .then(async (events) => {
        if (events.length > 0) {
          await db.update(contactsTable)
            .set({ birthdayEvents: JSON.stringify(events) })
            .where(eq(contactsTable.id, contact.id));
        }
      })
      .catch(() => {/* silently ignore */});
  } catch (err) {
    req.log.error({ err }, "Create contact error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const contacts = await db.select().from(contactsTable)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.userId, userId)))
      .limit(1);

    if (contacts.length === 0) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }

    res.json(formatContact(contacts[0]));
  } catch (err) {
    req.log.error({ err }, "Get contact error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Regenerate birthday events for a contact
router.post("/:id/birthday-events", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const contacts = await db.select().from(contactsTable)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.userId, userId)))
      .limit(1);

    if (contacts.length === 0) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }

    const contact = contacts[0];

    // Allow override month/day from query string (for refresh-before-save scenario)
    const birthdayMonth = req.query.month ? parseInt(req.query.month as string) : contact.birthdayMonth;
    const birthdayDay   = req.query.day   ? parseInt(req.query.day   as string) : contact.birthdayDay;

    const events = await generateBirthdayEvents(birthdayMonth, birthdayDay);

    await db.update(contactsTable)
      .set({ birthdayEvents: JSON.stringify(events) })
      .where(eq(contactsTable.id, id));

    res.json({ events });
  } catch (err) {
    req.log.error({ err }, "Generate birthday events error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send a test birthday reminder email for a contact
router.post("/:id/test-email", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const contacts = await db.select().from(contactsTable)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.userId, userId)))
      .limit(1);

    if (contacts.length === 0) { res.status(404).json({ error: "Contact not found" }); return; }

    const contact = contacts[0];
    if (!contact.reminderEmail) {
      res.status(400).json({ error: "该联系人未填写提醒邮箱" });
      return;
    }

    const daysUntil = calcDaysUntilBirthday(contact.birthdayMonth, contact.birthdayDay);
    const today = new Date();
    const age = contact.birthYear ? today.getFullYear() - contact.birthYear : null;
    const birthdayDisplay = formatBirthdayDisplay(contact.birthdayMonth, contact.birthdayDay, contact.birthdayLunar);

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
    });
  } catch (err) {
    req.log.error({ err }, "Failed to send test reminder email");
    res.status(500).json({ error: "发送测试邮件失败，请检查邮箱配置" });
  }
});

router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const body = UpdateContactBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const existing = await db.select().from(contactsTable)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }

    const updatePayload: Record<string, unknown> = { ...body.data };
    // Never touch birthdayEvents on save — events are managed exclusively via the
    // dedicated birthday-events endpoint (refresh button). This preserves any
    // events the user already generated before clicking save.

    const updated = await db.update(contactsTable)
      .set(updatePayload)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.userId, userId)))
      .returning();

    const contact = updated[0];
    res.json(formatContact(contact));
  } catch (err) {
    req.log.error({ err }, "Update contact error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const existing = await db.select().from(contactsTable)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.userId, userId)))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }

    await db.delete(contactsTable)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.userId, userId)));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete contact error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
