import { Router, type IRouter } from "express";
import { db, contactsTable } from "@workspace/db";
import { eq, and, asc, like } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { CreateContactBody, UpdateContactBody } from "@workspace/api-zod";
import { formatBirthdayDisplay, calcDaysUntilBirthday } from "../lib/birthday.js";
import { generateBirthdayEvents, BirthdayEvent } from "../lib/birthday-events.js";

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
    birthdayEvents: parseBirthdayEvents(c.birthdayEvents),
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

    const contact = inserted[0];
    res.status(201).json(formatContact(contact));

    // Generate birthday events in the background (non-blocking)
    generateBirthdayEvents(contact.birthdayMonth, contact.birthdayDay, contact.birthdayLunar)
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
    const events = await generateBirthdayEvents(
      contact.birthdayMonth,
      contact.birthdayDay,
      contact.birthdayLunar
    );

    await db.update(contactsTable)
      .set({ birthdayEvents: JSON.stringify(events) })
      .where(eq(contactsTable.id, id));

    res.json({ events });
  } catch (err) {
    req.log.error({ err }, "Generate birthday events error");
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

    // If birthday changed, clear cached events so they regenerate
    const prev = existing[0];
    const birthdayChanged =
      (body.data.birthdayMonth !== undefined && body.data.birthdayMonth !== prev.birthdayMonth) ||
      (body.data.birthdayDay !== undefined && body.data.birthdayDay !== prev.birthdayDay) ||
      (body.data.birthdayLunar !== undefined && body.data.birthdayLunar !== prev.birthdayLunar);

    const updatePayload: Record<string, unknown> = { ...body.data };
    if (birthdayChanged) {
      updatePayload.birthdayEvents = null;
    }

    const updated = await db.update(contactsTable)
      .set(updatePayload)
      .where(and(eq(contactsTable.id, id), eq(contactsTable.userId, userId)))
      .returning();

    const contact = updated[0];
    res.json(formatContact(contact));

    // Re-generate events in background if birthday changed
    if (birthdayChanged) {
      generateBirthdayEvents(contact.birthdayMonth, contact.birthdayDay, contact.birthdayLunar)
        .then(async (events) => {
          if (events.length > 0) {
            await db.update(contactsTable)
              .set({ birthdayEvents: JSON.stringify(events) })
              .where(eq(contactsTable.id, id));
          }
        })
        .catch(() => {/* silently ignore */});
    }
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
