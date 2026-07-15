import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { db, feedbackTable, usersTable } from "@workspace/db";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage.js";
import { LOCAL_UPLOAD_DIR } from "./upload.js";
import {
  parseImagesJson,
  sanitizeAdminReply,
} from "../lib/feedback-utils.js";

const router = Router();

const VALID_STATUS = new Set(["pending", "processing", "resolved"]);

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

const feedbackImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith("image/") || file.mimetype === "application/octet-stream";
    cb(ok ? null : new Error("只支持图片格式"), ok);
  },
});

const APP_LABELS: Record<string, string> = {
  birthday_mp: "生日通小程序",
  xishi_toolbox_mp: "惜时工具箱小程序",
  xishi_toolbox_pc: "惜时工具箱PC端",
};

function mapFeedbackRow(row: {
  id: number;
  userId: number;
  appKey: string;
  content: string;
  contact: string | null;
  images: string | null;
  status: string;
  adminReply: string | null;
  userReadAt: Date | null;
  repliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  nickname: string | null;
  avatarUrl: string | null;
}) {
  return {
    ...row,
    images: parseImagesJson(row.images),
    appLabel: APP_LABELS[row.appKey] || row.appKey,
  };
}

// GET /api/admin/feedback
router.get("/", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const appKey = typeof req.query.appKey === "string" ? req.query.appKey.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const startDateRaw = typeof req.query.startDate === "string" ? req.query.startDate.trim() : "";
    const endDateRaw = typeof req.query.endDate === "string" ? req.query.endDate.trim() : "";

    const conditions = [];
    if (appKey) conditions.push(eq(feedbackTable.appKey, appKey));
    if (status && VALID_STATUS.has(status)) conditions.push(eq(feedbackTable.status, status));

    if (/^\d{4}-\d{2}-\d{2}$/.test(startDateRaw)) {
      const start = new Date(`${startDateRaw}T00:00:00`);
      if (!Number.isNaN(start.getTime())) conditions.push(gte(feedbackTable.createdAt, start));
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDateRaw)) {
      const end = new Date(`${endDateRaw}T23:59:59.999`);
      if (!Number.isNaN(end.getTime())) conditions.push(lte(feedbackTable.createdAt, end));
    }

    let query = db
      .select({
        id: feedbackTable.id,
        userId: feedbackTable.userId,
        appKey: feedbackTable.appKey,
        content: feedbackTable.content,
        contact: feedbackTable.contact,
        images: feedbackTable.images,
        status: feedbackTable.status,
        adminReply: feedbackTable.adminReply,
        userReadAt: feedbackTable.userReadAt,
        repliedAt: feedbackTable.repliedAt,
        createdAt: feedbackTable.createdAt,
        updatedAt: feedbackTable.updatedAt,
        nickname: usersTable.nickname,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(feedbackTable)
      .leftJoin(usersTable, eq(feedbackTable.userId, usersTable.id));

    if (conditions.length === 1) {
      query = query.where(conditions[0]) as typeof query;
    } else if (conditions.length > 1) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const rows = await query.orderBy(desc(feedbackTable.updatedAt));

    res.json({
      feedback: rows.map(mapFeedbackRow),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list admin feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/feedback/pending-count — count of unprocessed feedback
router.get("/pending-count", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedbackTable)
      .where(eq(feedbackTable.status, "pending"));

    res.json({ count: rows[0]?.count ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to count pending feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/feedback/upload-image — admin rich-text image upload
router.post(
  "/upload-image",
  (req: Request, res: Response, next) => {
    if (!requireAdmin(req, res)) return;
    next();
  },
  feedbackImageUpload.single("image"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "请上传图片" });
      return;
    }

    try {
      const file = req.file as Express.Multer.File & { buffer: Buffer };
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      const filename = `fb_${crypto.randomBytes(12).toString("hex")}${ext}`;

      if (useObjectStorage()) {
        const objectPath = `uploads/${filename}`;
        const contentType = resolveMime(file.originalname, file.mimetype);
        const bucket = getBucket();
        await bucket.file(objectPath).save(file.buffer, { contentType, resumable: false });
      } else {
        if (!fs.existsSync(LOCAL_UPLOAD_DIR)) fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
        fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, filename), file.buffer);
      }

      res.json({ url: `/api/uploads/${filename}` });
    } catch (err) {
      req.log.error({ err }, "Failed to upload feedback image");
      res.status(500).json({ error: "上传失败" });
    }
  },
);

// PUT /api/admin/feedback/:id
router.put("/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const body = req.body as { status?: string; adminReply?: string };
    const updates: Partial<typeof feedbackTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.status !== undefined) {
      const status = String(body.status).trim();
      if (!VALID_STATUS.has(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      updates.status = status;
    }

    if (body.adminReply !== undefined) {
      const reply = sanitizeAdminReply(String(body.adminReply));
      updates.adminReply = reply || null;
      if (reply) {
        updates.repliedAt = new Date();
        updates.userReadAt = null;
      }
    }

    const updated = await db
      .update(feedbackTable)
      .set(updates)
      .where(eq(feedbackTable.id, id))
      .returning();

    if (!updated.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json({ success: true, feedback: updated[0] });
  } catch (err) {
    req.log.error({ err }, "Failed to update feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
