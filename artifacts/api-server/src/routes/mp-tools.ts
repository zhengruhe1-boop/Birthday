import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";
import { objectStorageClient } from "../lib/objectStorage.js";
import { LOCAL_UPLOAD_DIR } from "./upload.js";

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

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
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
  };
  return extMap[ext] ?? (declaredMime.startsWith("image/") ? declaredMime : "image/jpeg");
}

const iconUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith("image/") || file.mimetype === "application/octet-stream";
    cb(ok ? null : new Error("只支持图片格式"), ok);
  },
});

// ── Public: GET /api/mp-tools ─────────────────────────────────────────────────
router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT id, name, description, icon, type, path, app_id, page_path, sort_order
      FROM mp_tools
      WHERE enabled = true
      ORDER BY sort_order ASC, id ASC
    `);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: GET /api/mp-tools/admin ────────────────────────────────────────────
router.get("/admin", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await db.execute(sql`SELECT * FROM mp_tools ORDER BY sort_order ASC, id ASC`);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: POST /api/mp-tools/admin/upload-icon ───────────────────────────────
// Must be before /admin/:id to avoid param capture
router.post("/admin/upload-icon", (req: Request, res: Response, next) => {
  if (!requireAdmin(req, res)) return;
  next();
}, iconUpload.single("image"), async (req: Request, res: Response) => {
  if (!req.file) return void res.status(400).json({ error: "请上传图片" });
  try {
    const file = req.file as Express.Multer.File & { buffer: Buffer };
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const filename = "icon_" + crypto.randomBytes(12).toString("hex") + ext;

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
    res.status(500).json({ error: "上传失败" });
  }
});

// ── Admin: POST /api/mp-tools/admin ───────────────────────────────────────────
router.post("/admin", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { name, description = "", icon = "🔧", type = "internal", path: p = "", app_id = "", page_path = "", enabled = true } = req.body as {
      name: string; description?: string; icon?: string; type?: string;
      path?: string; app_id?: string; page_path?: string; enabled?: boolean;
    };
    if (!name) return void res.status(400).json({ error: "name is required" });
    const maxOrderResult = await db.execute(sql`SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM mp_tools`);
    const maxOrder = Number((maxOrderResult.rows[0] as any)?.max_order ?? -1);
    const result = await db.execute(sql`
      INSERT INTO mp_tools (name, description, icon, type, path, app_id, page_path, sort_order, enabled)
      VALUES (${name}, ${description}, ${icon}, ${type}, ${p}, ${app_id}, ${page_path}, ${maxOrder + 1}, ${enabled})
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: PUT /api/mp-tools/admin/reorder ────────────────────────────────────
// Must be before /admin/:id to avoid param capture
router.put("/admin/reorder", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids)) return void res.status(400).json({ error: "ids must be an array" });
    for (let i = 0; i < ids.length; i++) {
      await db.execute(sql`UPDATE mp_tools SET sort_order = ${i} WHERE id = ${ids[i]}`);
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: PUT /api/mp-tools/admin/:id ────────────────────────────────────────
router.put("/admin/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description, icon, type, path: p, app_id, page_path, enabled } = req.body as {
      name?: string; description?: string; icon?: string; type?: string;
      path?: string; app_id?: string; page_path?: string; enabled?: boolean;
    };
    const result = await db.execute(sql`
      UPDATE mp_tools SET
        name        = COALESCE(${name ?? null}, name),
        description = COALESCE(${description ?? null}, description),
        icon        = COALESCE(${icon ?? null}, icon),
        type        = COALESCE(${type ?? null}, type),
        path        = COALESCE(${p ?? null}, path),
        app_id      = COALESCE(${app_id ?? null}, app_id),
        page_path   = COALESCE(${page_path ?? null}, page_path),
        enabled     = COALESCE(${enabled ?? null}, enabled)
      WHERE id = ${id}
      RETURNING *
    `);
    if (!result.rows.length) return void res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: DELETE /api/mp-tools/admin/:id ─────────────────────────────────────
router.delete("/admin/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = parseInt(req.params.id, 10);
    await db.execute(sql`DELETE FROM mp_tools WHERE id = ${id}`);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Public: GET /api/mp-tools/builtin ─────────────────────────────────────────
router.get("/builtin", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT key, value FROM settings
      WHERE key IN ('tool_date_calc_enabled', 'tool_date_calc_icon',
                    'tool_age_calc_enabled', 'tool_age_calc_icon')
    `);
    const rows = result.rows as { key: string; value: string }[];
    const byKey: Record<string, string> = {};
    rows.forEach((r) => { byKey[r.key] = r.value; });
    res.json({
      date_calc: byKey["tool_date_calc_enabled"] !== "false",
      date_calc_icon: byKey["tool_date_calc_icon"] || null,
      age_calc: byKey["tool_age_calc_enabled"] !== "false",
      age_calc_icon: byKey["tool_age_calc_icon"] || null,
    });
  } catch {
    res.json({ date_calc: true, date_calc_icon: null });
  }
});

// ── Admin: PUT /api/mp-tools/builtin/:name ────────────────────────────────────
router.put("/builtin/:name", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { name } = req.params;
  const { enabled, icon } = req.body as { enabled?: boolean; icon?: string };
  try {
    if (enabled !== undefined) {
      const key = `tool_${name}_enabled`;
      await db.execute(sql`
        INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${String(enabled)}, now())
        ON CONFLICT (key) DO UPDATE SET value = ${String(enabled)}, updated_at = now()
      `);
    }
    if (icon !== undefined) {
      const iconKey = `tool_${name}_icon`;
      await db.execute(sql`
        INSERT INTO settings (key, value, updated_at) VALUES (${iconKey}, ${icon}, now())
        ON CONFLICT (key) DO UPDATE SET value = ${icon}, updated_at = now()
      `);
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: POST /api/mp-tools/builtin/:name/upload-icon ──────────────────────
router.post("/builtin/:name/upload-icon", iconUpload.single("image"), async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  if (!req.file) { res.status(400).json({ error: "No file" }); return; }
  try {
    const file = req.file as Express.Multer.File & { buffer: Buffer };
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const filename = "builtin_icon_" + req.params.name + "_" + crypto.randomBytes(8).toString("hex") + ext;
    if (useObjectStorage()) {
      const contentType = resolveMime(file.originalname, file.mimetype);
      await getBucket().file(`uploads/${filename}`).save(file.buffer, { contentType, resumable: false });
    } else {
      if (!fs.existsSync(LOCAL_UPLOAD_DIR)) fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, filename), file.buffer);
    }
    res.json({ url: `/api/uploads/${filename}` });
  } catch {
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
