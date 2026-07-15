import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { db, announcementsTable, announcementReadsTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage.js";
import { LOCAL_UPLOAD_DIR } from "./upload.js";
import {
  formatAnnouncementRow,
  normalizeAppKeys,
  sanitizeAnnouncementContent,
  serializeAppKeys,
} from "../lib/announcement-utils.js";

const router = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const key = req.headers["x-admin-key"];
  const adminKey = process.env.ADMIN_KEY || "birthday-admin-2024";
  if (key !== adminKey) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function useObjectStorage(): boolean {
  return !!process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
}

function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return objectStorageClient.bucket(bucketId);
}

function resolveMime(originalname: string, declaredMime: string): string {
  const ext = path.extname(originalname).toLowerCase();
  const extMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  if (extMap[ext]) return extMap[ext];
  if (declaredMime.startsWith("image/")) return declaredMime;
  return "image/jpeg";
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith("image/") || file.mimetype === "application/octet-stream";
    cb(ok ? null : new Error("只支持图片格式"), ok);
  },
});

// GET /api/admin/announcements
router.get("/", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const appKey = typeof req.query.appKey === "string" ? req.query.appKey.trim() : "";
    const [rows, readCounts] = await Promise.all([
      db
        .select()
        .from(announcementsTable)
        .orderBy(desc(announcementsTable.createdAt)),
      db
        .select({
          announcementId: announcementReadsTable.announcementId,
          count: sql<number>`count(*)::int`,
        })
        .from(announcementReadsTable)
        .groupBy(announcementReadsTable.announcementId),
    ]);

    const countMap = new Map(
      readCounts.map((r) => [r.announcementId, Number(r.count) || 0]),
    );

    const filtered = appKey
      ? rows.filter((row) => {
          try {
            const keys = JSON.parse(row.appKeys);
            return Array.isArray(keys) && keys.includes(appKey);
          } catch {
            return false;
          }
        })
      : rows;

    res.json({
      announcements: filtered.map((row) => ({
        ...formatAnnouncementRow(row),
        readCount: countMap.get(row.id) ?? 0,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list announcements");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/announcements/upload-image
router.post(
  "/upload-image",
  (req, res, next) => {
    if (!requireAdmin(req, res)) return;
    next();
  },
  imageUpload.single("image"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "请上传图片" });
        return;
      }
      const mime = resolveMime(req.file.originalname, req.file.mimetype);
      const ext = mime === "image/png" ? "png" : mime === "image/gif" ? "gif" : mime === "image/webp" ? "webp" : "jpg";
      const filename = `ann_${crypto.randomBytes(12).toString("hex")}.${ext}`;

      if (useObjectStorage()) {
        const bucket = getBucket();
        const file = bucket.file(`uploads/${filename}`);
        await file.save(req.file.buffer, { contentType: mime, resumable: false });
      } else {
        if (!fs.existsSync(LOCAL_UPLOAD_DIR)) fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
        fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, filename), req.file.buffer);
      }

      res.json({ url: `/api/uploads/${filename}` });
    } catch (err) {
      req.log.error({ err }, "Failed to upload announcement image");
      res.status(500).json({ error: "上传失败" });
    }
  },
);

// POST /api/admin/announcements
router.post("/", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const body = req.body as {
      title?: string;
      content?: string;
      appKeys?: string[];
      status?: string;
    };
    const title = (body.title || "").trim();
    const content = sanitizeAnnouncementContent(body.content || "");
    const appKeys = normalizeAppKeys(body.appKeys);
    const status = body.status === "draft" ? "draft" : "published";

    if (!title) {
      res.status(400).json({ error: "请填写标题" });
      return;
    }
    if (title.length > 100) {
      res.status(400).json({ error: "标题不能超过 100 字" });
      return;
    }
    if (!content) {
      res.status(400).json({ error: "请填写正文" });
      return;
    }
    if (appKeys.length === 0) {
      res.status(400).json({ error: "请至少选择一个发布应用" });
      return;
    }

    const now = new Date();
    const inserted = await db
      .insert(announcementsTable)
      .values({
        title,
        content,
        appKeys: serializeAppKeys(appKeys),
        status,
        publishedAt: status === "published" ? now : null,
        updatedAt: now,
      })
      .returning();

    res.status(201).json({ announcement: formatAnnouncementRow(inserted[0]) });
  } catch (err) {
    req.log.error({ err }, "Failed to create announcement");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/announcements/:id
router.put("/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const existing = await db
      .select()
      .from(announcementsTable)
      .where(eq(announcementsTable.id, id))
      .limit(1);
    if (!existing[0]) {
      res.status(404).json({ error: "消息不存在" });
      return;
    }

    const body = req.body as {
      title?: string;
      content?: string;
      appKeys?: string[];
      status?: string;
    };

    const title = typeof body.title === "string" ? body.title.trim() : existing[0].title;
    const content =
      typeof body.content === "string"
        ? sanitizeAnnouncementContent(body.content)
        : existing[0].content;
    const appKeys =
      body.appKeys !== undefined ? normalizeAppKeys(body.appKeys) : undefined;
    const status =
      body.status === "draft" || body.status === "published" ? body.status : existing[0].status;

    if (!title) {
      res.status(400).json({ error: "请填写标题" });
      return;
    }
    if (title.length > 100) {
      res.status(400).json({ error: "标题不能超过 100 字" });
      return;
    }
    if (!content) {
      res.status(400).json({ error: "请填写正文" });
      return;
    }
    if (appKeys !== undefined && appKeys.length === 0) {
      res.status(400).json({ error: "请至少选择一个发布应用" });
      return;
    }

    const now = new Date();
    let publishedAt = existing[0].publishedAt;
    if (status === "published" && !publishedAt) publishedAt = now;
    if (status === "draft") publishedAt = null;

    const updated = await db
      .update(announcementsTable)
      .set({
        title,
        content,
        ...(appKeys ? { appKeys: serializeAppKeys(appKeys) } : {}),
        status,
        publishedAt,
        updatedAt: now,
      })
      .where(eq(announcementsTable.id, id))
      .returning();

    res.json({ announcement: formatAnnouncementRow(updated[0]) });
  } catch (err) {
    req.log.error({ err }, "Failed to update announcement");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/announcements/:id
router.delete("/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const deleted = await db
      .delete(announcementsTable)
      .where(eq(announcementsTable.id, id))
      .returning({ id: announcementsTable.id });

    if (!deleted[0]) {
      res.status(404).json({ error: "消息不存在" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete announcement");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
