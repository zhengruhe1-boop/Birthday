import { Router, type IRouter } from "express";
import { db, timeCapsulesTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();
router.use(requireAuth);

function parsePhotoUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function formatCapsule(row: typeof timeCapsulesTable.$inferSelect) {
  const now = new Date();
  const openDate = new Date(row.openAt + ":00");
  const isOpened = now >= openDate;
  const daysUntil = Math.ceil((openDate.getTime() - now.getTime()) / 86400000);
  return {
    ...row,
    photoUrls: parsePhotoUrls(row.photoUrls),
    isOpened,
    daysUntil: isOpened ? 0 : daysUntil,
  };
}

// GET /api/capsules
router.get("/", async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(timeCapsulesTable)
      .where(eq(timeCapsulesTable.userId, req.userId!))
      .orderBy(asc(timeCapsulesTable.openAt));
    res.json(rows.map(formatCapsule));
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/capsules/:id
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await db.select().from(timeCapsulesTable)
      .where(and(eq(timeCapsulesTable.id, id), eq(timeCapsulesTable.userId, req.userId!)));
    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatCapsule(rows[0]));
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/capsules
router.post("/", async (req: AuthRequest, res) => {
  try {
    const { message, photoUrls, openAt, reminderEmail, notifyEnabled } = req.body as Record<string, unknown>;
    if (!message || !openAt) {
      res.status(400).json({ error: "message and openAt are required" });
      return;
    }
    const photoUrlsStr = Array.isArray(photoUrls) ? JSON.stringify(photoUrls) : null;
    const [row] = await db.insert(timeCapsulesTable).values({
      userId: req.userId!,
      message: String(message),
      photoUrls: photoUrlsStr,
      openAt: String(openAt),
      reminderEmail: reminderEmail ? String(reminderEmail) : null,
      notifyEnabled: notifyEnabled !== false,
    }).returning();
    res.status(201).json(formatCapsule(row));
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/capsules/:id
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { message, photoUrls, openAt, reminderEmail, notifyEnabled } = req.body as Record<string, unknown>;
    const photoUrlsStr = Array.isArray(photoUrls) ? JSON.stringify(photoUrls) : null;
    const rows = await db.update(timeCapsulesTable)
      .set({
        message: message ? String(message) : undefined,
        photoUrls: photoUrlsStr,
        openAt: openAt ? String(openAt) : undefined,
        reminderEmail: reminderEmail ? String(reminderEmail) : null,
        notifyEnabled: notifyEnabled !== false,
      })
      .where(and(eq(timeCapsulesTable.id, id), eq(timeCapsulesTable.userId, req.userId!)))
      .returning();
    if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatCapsule(rows[0]));
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/capsules/:id
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(timeCapsulesTable)
      .where(and(eq(timeCapsulesTable.id, id), eq(timeCapsulesTable.userId, req.userId!)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
