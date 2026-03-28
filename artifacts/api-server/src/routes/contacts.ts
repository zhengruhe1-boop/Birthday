import { Router, type IRouter } from "express";
import { db, contactsTable } from "@workspace/db";
import { eq, and, asc, like } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { CreateContactBody, UpdateContactBody } from "@workspace/api-zod";
import { formatBirthdayDisplay, calcDaysUntilBirthday } from "../lib/birthday.js";

const router: IRouter = Router();

function formatContact(c: typeof contactsTable.$inferSelect) {
  const daysUntil = calcDaysUntilBirthday(c.birthdayMonth, c.birthdayDay);
  const birthdayDisplay = formatBirthdayDisplay(c.birthdayMonth, c.birthdayDay, c.birthdayLunar);
  
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
    daysUntilBirthday: daysUntil,
    age,
    birthdayDisplay,
    createdAt: c.createdAt,
  };
}

router.use(requireAuth);

router.get("/upcoming", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const allContacts = await db.select().from(contactsTable)
      .where(eq(contactsTable.userId, userId))
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
        .where(and(eq(contactsTable.userId, userId), like(contactsTable.name, `%${search}%`)))
        .orderBy(asc(contactsTable.name));
    } else {
      contacts = await db.select().from(contactsTable)
        .where(eq(contactsTable.userId, userId))
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

    const inserted = await db.insert(contactsTable).values({
      userId,
      ...body.data,
    }).returning();

    res.status(201).json(formatContact(inserted[0]));
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

    const updated = await db.update(contactsTable)
      .set(body.data)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.userId, userId)))
      .returning();

    res.json(formatContact(updated[0]));
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
