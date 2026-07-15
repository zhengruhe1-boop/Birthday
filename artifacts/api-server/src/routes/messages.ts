import { Router, type IRouter } from "express";
import {
  db,
  announcementsTable,
  announcementReadsTable,
  feedbackTable,
} from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { formatFeedbackRow } from "../lib/feedback-utils.js";
import {
  formatAnnouncementRow,
  parseAppKeysJson,
  stripHtmlPreview,
} from "../lib/announcement-utils.js";

const router: IRouter = Router();

function resolveAppKey(req: AuthRequest): string {
  const headerAppKey = req.headers["x-app-key"];
  if (typeof headerAppKey === "string" && headerAppKey.trim()) {
    return headerAppKey.trim();
  }
  return "birthday_mp";
}

async function loadPublishedForApp(appKey: string) {
  const rows = await db
    .select()
    .from(announcementsTable)
    .where(eq(announcementsTable.status, "published"))
    .orderBy(desc(announcementsTable.publishedAt));

  return rows.filter((row) => parseAppKeysJson(row.appKeys).includes(appKey));
}

// GET /api/messages — unified inbox (announcements + feedback)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const appKey = resolveAppKey(req);
    const userId = req.userId!;

    const [announcements, feedbackRows, readRows] = await Promise.all([
      loadPublishedForApp(appKey),
      db
        .select()
        .from(feedbackTable)
        .where(and(eq(feedbackTable.userId, userId), eq(feedbackTable.appKey, appKey)))
        .orderBy(desc(feedbackTable.updatedAt)),
      db
        .select({ announcementId: announcementReadsTable.announcementId })
        .from(announcementReadsTable)
        .where(
          and(
            eq(announcementReadsTable.userId, userId),
            eq(announcementReadsTable.appKey, appKey),
          ),
        ),
    ]);

    const readSet = new Set(readRows.map((r) => r.announcementId));

    const items: Array<{
      key: string;
      type: "announcement" | "feedback";
      id: number;
      title: string;
      preview: string;
      isUnread: boolean;
      status?: string;
      hasReply?: boolean;
      createdAt: Date | string;
      sortAt: number;
    }> = [];

    for (const row of announcements) {
      const isUnread = !readSet.has(row.id);
      const sortAt = (row.publishedAt || row.createdAt).getTime();
      items.push({
        key: `announcement-${row.id}`,
        type: "announcement",
        id: row.id,
        title: row.title,
        preview: stripHtmlPreview(row.content),
        isUnread,
        createdAt: row.publishedAt || row.createdAt,
        sortAt,
      });
    }

    for (const row of feedbackRows) {
      const formatted = formatFeedbackRow(row);
      const preview = formatted.hasReply
        ? stripHtmlPreview(formatted.adminReply || "")
        : formatted.content;
      items.push({
        key: `feedback-${row.id}`,
        type: "feedback",
        id: row.id,
        title: "问题反馈",
        preview,
        isUnread: formatted.isUnread,
        status: formatted.status,
        hasReply: formatted.hasReply,
        createdAt: row.updatedAt || row.createdAt,
        sortAt: (row.updatedAt || row.createdAt).getTime(),
      });
    }

    items.sort((a, b) => b.sortAt - a.sortAt);

    res.json({
      messages: items.map(({ sortAt: _s, ...rest }) => rest),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/messages/unread-count
router.get("/unread-count", requireAuth, async (req: AuthRequest, res) => {
  try {
    const appKey = resolveAppKey(req);
    const userId = req.userId!;

    const [announcements, feedbackUnread, readRows] = await Promise.all([
      loadPublishedForApp(appKey),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(feedbackTable)
        .where(
          and(
            eq(feedbackTable.userId, userId),
            eq(feedbackTable.appKey, appKey),
            sql`${feedbackTable.adminReply} IS NOT NULL`,
            isNull(feedbackTable.userReadAt),
          ),
        ),
      db
        .select({ announcementId: announcementReadsTable.announcementId })
        .from(announcementReadsTable)
        .where(
          and(
            eq(announcementReadsTable.userId, userId),
            eq(announcementReadsTable.appKey, appKey),
          ),
        ),
    ]);

    const readSet = new Set(readRows.map((r) => r.announcementId));
    const announcementUnread = announcements.filter((a) => !readSet.has(a.id)).length;
    const feedbackCount = feedbackUnread[0]?.count ?? 0;

    res.json({ count: announcementUnread + feedbackCount });
  } catch (err) {
    req.log.error({ err }, "Failed to count unread messages");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/messages/announcements/:id — detail & mark read
router.get("/announcements/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const appKey = resolveAppKey(req);
    const userId = req.userId!;

    const rows = await db
      .select()
      .from(announcementsTable)
      .where(eq(announcementsTable.id, id))
      .limit(1);

    const row = rows[0];
    if (!row || row.status !== "published") {
      res.status(404).json({ error: "消息不存在" });
      return;
    }

    const appKeys = parseAppKeysJson(row.appKeys);
    if (!appKeys.includes(appKey)) {
      res.status(404).json({ error: "消息不存在" });
      return;
    }

    const existingRead = await db
      .select({ id: announcementReadsTable.id })
      .from(announcementReadsTable)
      .where(
        and(
          eq(announcementReadsTable.announcementId, id),
          eq(announcementReadsTable.userId, userId),
          eq(announcementReadsTable.appKey, appKey),
        ),
      )
      .limit(1);

    if (!existingRead[0]) {
      await db.insert(announcementReadsTable).values({
        announcementId: id,
        userId,
        appKey,
      });
    }

    res.json({
      announcement: formatAnnouncementRow(row, { isUnread: false }),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load announcement detail");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
