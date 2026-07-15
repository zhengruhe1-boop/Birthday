import { Router, type IRouter } from "express";
import { db, feedbackTable } from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import {
  formatFeedbackRow,
  normalizeImageUrls,
  serializeImages,
} from "../lib/feedback-utils.js";

const router: IRouter = Router();

function resolveAppKey(req: AuthRequest): string {
  const headerAppKey = req.headers["x-app-key"];
  if (typeof headerAppKey === "string" && headerAppKey.trim()) {
    return headerAppKey.trim();
  }
  return "birthday_mp";
}

// POST /api/feedback — submit feedback (login required)
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body as { content?: string; contact?: string; images?: string[] };
    const content = (body.content || "").trim();
    const images = normalizeImageUrls(body.images);

    if (!content && images.length === 0) {
      res.status(400).json({ error: "请填写反馈内容或上传图片" });
      return;
    }
    if (content.length > 2000) {
      res.status(400).json({ error: "反馈内容不能超过 2000 字" });
      return;
    }

    const contact = (body.contact || "").trim().slice(0, 100);
    const appKey = resolveAppKey(req);

    const inserted = await db
      .insert(feedbackTable)
      .values({
        userId: req.userId!,
        appKey,
        content: content || "（图片反馈）",
        contact: contact || null,
        images: serializeImages(images),
        status: "pending",
      })
      .returning();

    res.status(201).json({ feedback: formatFeedbackRow(inserted[0]) });
  } catch (err) {
    req.log.error({ err }, "Failed to submit feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/feedback/mine — list current user's feedback
router.get("/mine", requireAuth, async (req: AuthRequest, res) => {
  try {
    const appKey = resolveAppKey(req);
    const rows = await db
      .select()
      .from(feedbackTable)
      .where(and(eq(feedbackTable.userId, req.userId!), eq(feedbackTable.appKey, appKey)))
      .orderBy(desc(feedbackTable.updatedAt));

    res.json({ feedback: rows.map(formatFeedbackRow) });
  } catch (err) {
    req.log.error({ err }, "Failed to list user feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/feedback/unread-count — unread admin replies
router.get("/unread-count", requireAuth, async (req: AuthRequest, res) => {
  try {
    const appKey = resolveAppKey(req);
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedbackTable)
      .where(
        and(
          eq(feedbackTable.userId, req.userId!),
          eq(feedbackTable.appKey, appKey),
          sql`${feedbackTable.adminReply} IS NOT NULL`,
          isNull(feedbackTable.userReadAt),
        ),
      );

    res.json({ count: rows[0]?.count ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to count unread feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/feedback/:id — detail & mark as read
router.get("/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const rows = await db
      .select()
      .from(feedbackTable)
      .where(and(eq(feedbackTable.id, id), eq(feedbackTable.userId, req.userId!)))
      .limit(1);

    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (row.adminReply && !row.userReadAt) {
      const updated = await db
        .update(feedbackTable)
        .set({ userReadAt: new Date(), updatedAt: new Date() })
        .where(eq(feedbackTable.id, id))
        .returning();
      res.json({ feedback: formatFeedbackRow(updated[0]) });
      return;
    }

    res.json({ feedback: formatFeedbackRow(row) });
  } catch (err) {
    req.log.error({ err }, "Failed to read feedback detail");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
