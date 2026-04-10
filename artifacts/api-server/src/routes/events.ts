import { Router, type IRouter } from "express";
import { db, eventsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();
router.use(requireAuth);

// ── helpers ─────────────────────────────────────────────────────────────────

function daysUntilDate(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  return diff;
}

function daysUntilAnniversary(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (thisYear < today) {
    thisYear.setFullYear(today.getFullYear() + 1);
  }
  return Math.round((thisYear.getTime() - today.getTime()) / 86400000);
}

function formatEvent(e: typeof eventsTable.$inferSelect) {
  let daysUntil: number | null = null;
  if (e.type === "anniversary" && e.eventDate) {
    daysUntil = daysUntilAnniversary(e.eventDate);
  } else if (e.type === "countdown" && e.eventDate) {
    daysUntil = daysUntilDate(e.eventDate);
  } else if (e.type === "other" && e.reminderTime) {
    const dStr = e.reminderTime.split(" ")[0];
    daysUntil = daysUntilDate(dStr);
  }
  return { ...e, daysUntil };
}

// ── GET /api/events ──────────────────────────────────────────────────────────
router.get("/", async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(eventsTable)
      .where(eq(eventsTable.userId, req.userId!))
      .orderBy(asc(eventsTable.createdAt));
    res.json(rows.map(formatEvent));
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/events/upcoming ─────────────────────────────────────────────────
router.get("/upcoming", async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(eventsTable)
      .where(eq(eventsTable.userId, req.userId!));

    const formatted = rows.map(formatEvent);

    const anniversaries = formatted
      .filter(e => e.type === "anniversary" && e.daysUntil !== null && e.daysUntil >= 0)
      .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));

    const countdowns = formatted
      .filter(e => e.type === "countdown" && e.daysUntil !== null && e.daysUntil >= 0)
      .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));

    const others = formatted
      .filter(e => e.type === "other")
      .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));

    res.json({ anniversaries, countdowns, others });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/events/:id ──────────────────────────────────────────────────────
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(eventsTable)
      .where(and(eq(eventsTable.id, id), eq(eventsTable.userId, req.userId!)));
    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatEvent(rows[0]));
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/events ─────────────────────────────────────────────────────────
router.post("/", async (req: AuthRequest, res) => {
  try {
    const { type, name, eventDate, person, reminderTime, reminderEmail } = req.body as Record<string, string>;
    if (!type || !name) { res.status(400).json({ error: "type and name required" }); return; }
    const [row] = await db.insert(eventsTable).values({
      userId: req.userId!,
      type,
      name,
      eventDate:     eventDate     || null,
      person:        person        || null,
      reminderTime:  reminderTime  || null,
      reminderEmail: reminderEmail || null,
    }).returning();
    res.status(201).json(formatEvent(row));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err, msg }, "POST /api/events failed");
    res.status(500).json({ error: "Internal server error", detail: msg });
  }
});

// ── PUT /api/events/:id ──────────────────────────────────────────────────────
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { name, eventDate, person, reminderTime, reminderEmail } = req.body as Record<string, string>;
    const rows = await db.update(eventsTable)
      .set({
        name,
        eventDate:     eventDate     || null,
        person:        person        || null,
        reminderTime:  reminderTime  || null,
        reminderEmail: reminderEmail || null,
      })
      .where(and(eq(eventsTable.id, id), eq(eventsTable.userId, req.userId!)))
      .returning();
    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatEvent(rows[0]));
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/events/:id ───────────────────────────────────────────────────
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(eventsTable)
      .where(and(eq(eventsTable.id, id), eq(eventsTable.userId, req.userId!)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
