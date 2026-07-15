import { Router, type Request, type Response } from "express";
import { db, analyticsEventsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
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

function resolveAppKey(req: Request): string {
  const header = req.headers["x-app-key"];
  const query = req.query.app_key;
  return (typeof header === "string" ? header : typeof query === "string" ? query : "birthday_mp").trim() || "birthday_mp";
}

function normalizeCategoryId(id: unknown): number | null {
  if (id === null || id === undefined || id === "") return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function groupToolsIntoCategories(cats: any[], toolRows: any[]) {
  const catIds = new Set(
    cats.map((c) => normalizeCategoryId(c.id)).filter((id): id is number => id !== null),
  );
  const groups = cats.map((cat) => ({
    ...cat,
    tools: toolRows
      .filter((t) => normalizeCategoryId(t.category_id) === normalizeCategoryId(cat.id))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  }));
  const uncategorized = toolRows.filter((t) => {
    const cid = normalizeCategoryId(t.category_id);
    return cid === null || !catIds.has(cid);
  });
  if (uncategorized.length > 0) {
    groups.push({
      id: null,
      name: "其他工具",
      icon: "",
      sort_order: 9999,
      tools: uncategorized.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    });
  }
  return groups;
}

// ── Public: GET /api/mp-tools ─────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    const appKey = resolveAppKey(req);
    // Query via bindings first; fall back to legacy app_key field
    const result = await db.execute(sql`
      SELECT DISTINCT ON (t.id)
        t.id, t.name, t.description, t.icon, t.type,
        COALESCE(NULLIF(b.path, ''), CASE WHEN t.path IS NOT NULL AND t.path NOT IN ('', '#') THEN t.path ELSE NULL END) AS path,
        t.app_id, t.page_path, t.sort_order,
        COALESCE(b.category_id, t.category_id) AS category_id,
        c.name AS category_name, c.icon AS category_icon, c.sort_order AS category_sort
      FROM mp_tools t
      LEFT JOIN mp_tool_app_bindings b ON b.tool_id = t.id AND b.app_key = ${appKey}
      LEFT JOIN mp_tool_categories c ON COALESCE(b.category_id, t.category_id) = c.id
      WHERE t.enabled = true
        AND (b.id IS NOT NULL AND b.enabled = true  OR  (b.id IS NULL AND t.app_key = ${appKey}))
      ORDER BY t.id, COALESCE(c.sort_order, 999) ASC, t.sort_order ASC
    `);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Public: GET /api/mp-tools/categories ──────────────────────────────────────
router.get("/categories", async (req: Request, res: Response) => {
  try {
    const appKey = resolveAppKey(req);
    const cats = await db.execute(sql`
      SELECT * FROM mp_tool_categories WHERE app_key = ${appKey} ORDER BY sort_order ASC, id ASC
    `);
    // Tools via bindings first, fallback to legacy app_key
    const tools = await db.execute(sql`
      SELECT DISTINCT ON (t.id)
        t.id, t.name, t.description, t.icon, t.type,
        COALESCE(NULLIF(b.path, ''), CASE WHEN t.path IS NOT NULL AND t.path NOT IN ('', '#') THEN t.path ELSE NULL END) AS path,
        t.app_id, t.page_path, t.sort_order,
        COALESCE(b.category_id, t.category_id) AS category_id
      FROM mp_tools t
      LEFT JOIN mp_tool_app_bindings b ON b.tool_id = t.id AND b.app_key = ${appKey}
      WHERE t.enabled = true
        AND (b.id IS NOT NULL AND b.enabled = true  OR  (b.id IS NULL AND t.app_key = ${appKey}))
      ORDER BY t.id, t.sort_order ASC
    `);
    const toolRows = [...(tools.rows as any[])];

    // Merge enabled builtin tools into toolRows
    const byKey = await readBuiltinSettings();
    const builtinBindings = await db.execute(
      sql`SELECT * FROM mp_tool_app_bindings WHERE app_key = ${appKey} AND builtin_name IS NOT NULL AND enabled = true`
    );
    for (const bb of builtinBindings.rows as any[]) {
      const bName = bb.builtin_name;
      const defaults = BUILTIN_TOOL_DEFAULTS[bName];
      if (!defaults) continue;
      const globalEnabled = byKey[`tool_${bName}_enabled`] !== "false";
      if (!globalEnabled) continue;
      toolRows.push({
        id: `builtin_${bName}`,
        name: byKey[`tool_${bName}_name`] || defaults.name,
        description: byKey[`tool_${bName}_description`] || defaults.description,
        icon: byKey[`tool_${bName}_icon`] || defaults.icon,
        type: "internal",
        path: resolveBuiltinPath(bb.path, defaults.path),
        app_id: "",
        page_path: "",
        sort_order: byKey[`tool_${bName}_sort_order`] !== undefined ? Number(byKey[`tool_${bName}_sort_order`]) : defaults.sort_order,
        category_id: bb.category_id || null,
        is_builtin: true,
      });
    }

    res.json({ categories: groupToolsIntoCategories(cats.rows as any[], toolRows) });
  } catch (err) {
    req.log.error({ err }, "Failed to load categories");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: GET /api/mp-tools/admin ────────────────────────────────────────────
router.get("/admin", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await db.execute(sql`SELECT * FROM mp_tools ORDER BY sort_order ASC, id ASC`);
    const allTools = result.rows as any[];
    // Attach bindings to each tool
    const bResult = await db.execute(sql`SELECT * FROM mp_tool_app_bindings WHERE tool_id IS NOT NULL`);
    const allBindings = bResult.rows as any[];
    const toolsWithBindings = allTools.map((t: any) => ({
      ...t,
      bindings: allBindings.filter((b: any) => b.tool_id === t.id),
    }));
    res.json(toolsWithBindings);
  } catch (err) {
    req.log.error({ err }, "Failed to list admin tools");
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

// ── Admin: GET /api/mp-tools/admin/bindings/builtin ──────────────────────────
// Must be before /admin/:id to avoid param capture
router.get("/admin/bindings/builtin", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await db.execute(sql`SELECT * FROM mp_tool_app_bindings WHERE builtin_name IS NOT NULL ORDER BY builtin_name, app_key`);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: PUT /api/mp-tools/admin/bindings/builtin ─────────────────────────
router.put("/admin/bindings/builtin", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { builtin_name, bindings } = req.body as {
      builtin_name: string;
      bindings: { app_key: string; path: string; category_id?: number | null; enabled?: boolean }[];
    };
    if (!builtin_name || !Array.isArray(bindings)) return void res.status(400).json({ error: "builtin_name and bindings required" });
    await db.execute(sql`DELETE FROM mp_tool_app_bindings WHERE builtin_name = ${builtin_name}`);
    for (const b of bindings) {
      if (!b.app_key) continue;
      await db.execute(sql`
        INSERT INTO mp_tool_app_bindings (builtin_name, app_key, path, category_id, enabled)
        VALUES (${builtin_name}, ${b.app_key}, ${b.path || ""}, ${b.category_id ?? null}, ${b.enabled !== false})
      `);
    }
    const result = await db.execute(sql`SELECT * FROM mp_tool_app_bindings WHERE builtin_name = ${builtin_name}`);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: POST /api/mp-tools/admin ───────────────────────────────────────────
router.post("/admin", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { name, description = "", icon = "🔧", type = "internal", path: p = "", app_id = "", page_path = "", enabled = true, app_key = "birthday_mp", category_id, bindings } = req.body as {
      name: string; description?: string; icon?: string; type?: string;
      path?: string; app_id?: string; page_path?: string; enabled?: boolean;
      app_key?: string; category_id?: number | null;
      bindings?: { app_key: string; path: string; category_id?: number | null; enabled?: boolean }[];
    };
    if (!name) return void res.status(400).json({ error: "name is required" });
    const maxOrderResult = await db.execute(sql`SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM mp_tools`);
    const maxOrder = Number((maxOrderResult.rows[0] as any)?.max_order ?? -1);
    const catId = category_id ?? null;
    const result = await db.execute(sql`
      INSERT INTO mp_tools (name, description, icon, type, path, app_id, page_path, sort_order, enabled, app_key, category_id)
      VALUES (${name}, ${description}, ${icon}, ${type}, ${p}, ${app_id}, ${page_path}, ${maxOrder + 1}, ${enabled}, ${app_key}, ${catId})
      RETURNING *
    `);
    const tool = result.rows[0] as any;
    // Create bindings
    if (Array.isArray(bindings)) {
      for (const b of bindings) {
        if (!b.app_key) continue;
        await db.execute(sql`
          INSERT INTO mp_tool_app_bindings (tool_id, app_key, path, category_id, enabled)
          VALUES (${tool.id}, ${b.app_key}, ${b.path || ""}, ${b.category_id ?? null}, ${b.enabled !== false})
          ON CONFLICT (tool_id, app_key) DO UPDATE SET path = ${b.path || ""}, category_id = ${b.category_id ?? null}, enabled = ${b.enabled !== false}
        `);
      }
    }
    // Return with bindings
    const bResult = await db.execute(sql`SELECT * FROM mp_tool_app_bindings WHERE tool_id = ${tool.id}`);
    res.json({ ...tool, bindings: bResult.rows });
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
    const { name, description, icon, type, path: p, app_id, page_path, enabled, sort_order, category_id, bindings } = req.body as {
      name?: string; description?: string; icon?: string; type?: string;
      path?: string; app_id?: string; page_path?: string; enabled?: boolean; sort_order?: number;
      category_id?: number | null;
      bindings?: { app_key: string; path: string; category_id?: number | null; enabled?: boolean }[];
    };
    const sortOrderVal = (sort_order !== undefined && sort_order !== null) ? Number(sort_order) : null;
    const catIdClause = category_id === undefined
      ? sql`category_id`
      : sql`${category_id}`;
    const result = await db.execute(sql`
      UPDATE mp_tools SET
        name        = COALESCE(${name ?? null}, name),
        description = COALESCE(${description ?? null}, description),
        icon        = COALESCE(${icon ?? null}, icon),
        type        = COALESCE(${type ?? null}, type),
        path        = COALESCE(${p ?? null}, path),
        app_id      = COALESCE(${app_id ?? null}, app_id),
        page_path   = COALESCE(${page_path ?? null}, page_path),
        enabled     = COALESCE(${enabled ?? null}, enabled),
        sort_order  = COALESCE(${sortOrderVal}, sort_order),
        category_id = ${catIdClause}
      WHERE id = ${id}
      RETURNING *
    `);
    if (!result.rows.length) return void res.status(404).json({ error: "Not found" });
    // Sync bindings if provided
    if (Array.isArray(bindings)) {
      await db.execute(sql`DELETE FROM mp_tool_app_bindings WHERE tool_id = ${id}`);
      for (const b of bindings) {
        if (!b.app_key) continue;
        await db.execute(sql`
          INSERT INTO mp_tool_app_bindings (tool_id, app_key, path, category_id, enabled)
          VALUES (${id}, ${b.app_key}, ${b.path || ""}, ${b.category_id ?? null}, ${b.enabled !== false})
        `);
      }
    }
    const bResult = await db.execute(sql`SELECT * FROM mp_tool_app_bindings WHERE tool_id = ${id}`);
    res.json({ ...(result.rows[0] as any), bindings: bResult.rows });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: DELETE /api/mp-tools/admin/:id ─────────────────────────────────────
router.delete("/admin/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = parseInt(req.params.id, 10);
    await db.execute(sql`DELETE FROM mp_tool_app_bindings WHERE tool_id = ${id}`);
    await db.execute(sql`DELETE FROM mp_tools WHERE id = ${id}`);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: GET /api/mp-tools/admin/categories ────────────────────────────────
router.get("/admin/categories", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const appKey = typeof req.query.app_key === "string" ? req.query.app_key : "";
    const where = appKey ? sql`WHERE app_key = ${appKey}` : sql``;
    const result = await db.execute(sql`SELECT * FROM mp_tool_categories ${where} ORDER BY sort_order ASC, id ASC`);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: POST /api/mp-tools/admin/categories ───────────────────────────────
router.post("/admin/categories", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { name, icon = "", app_key = "birthday_mp", sort_order } = req.body as {
      name: string; icon?: string; app_key?: string; sort_order?: number;
    };
    if (!name) return void res.status(400).json({ error: "name is required" });
    const maxRow = await db.execute(sql`SELECT COALESCE(MAX(sort_order), -1) AS mx FROM mp_tool_categories WHERE app_key = ${app_key}`);
    const maxOrder = Number((maxRow.rows[0] as any)?.mx ?? -1);
    const so = sort_order ?? maxOrder + 1;
    const result = await db.execute(sql`
      INSERT INTO mp_tool_categories (name, icon, app_key, sort_order)
      VALUES (${name}, ${icon}, ${app_key}, ${so})
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: PUT /api/mp-tools/admin/categories/reorder ────────────────────────
// Must be before /admin/categories/:id to avoid param capture
router.put("/admin/categories/reorder", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids)) return void res.status(400).json({ error: "ids must be an array" });
    for (let i = 0; i < ids.length; i++) {
      await db.execute(sql`UPDATE mp_tool_categories SET sort_order = ${i} WHERE id = ${ids[i]}`);
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: PUT /api/mp-tools/admin/categories/:id ────────────────────────────
router.put("/admin/categories/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = parseInt(String(req.params.id), 10);
    const { name, icon, sort_order } = req.body as { name?: string; icon?: string; sort_order?: number };
    const iconValue = icon === undefined ? null : String(icon).trim();
    const result = await db.execute(sql`
      UPDATE mp_tool_categories SET
        name       = COALESCE(${name ?? null}, name),
        icon       = CASE WHEN ${icon !== undefined} THEN ${iconValue} ELSE icon END,
        sort_order = COALESCE(${sort_order !== undefined && sort_order !== null ? Number(sort_order) : null}, sort_order)
      WHERE id = ${id}
      RETURNING *
    `);
    if (!result.rows.length) return void res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: DELETE /api/mp-tools/admin/categories/:id ─────────────────────────
router.delete("/admin/categories/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = parseInt(String(req.params.id), 10);
    await db.execute(sql`UPDATE mp_tools SET category_id = NULL WHERE category_id = ${id}`);
    await db.execute(sql`DELETE FROM mp_tool_categories WHERE id = ${id}`);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Builtin tool defaults ─────────────────────────────────────────────────────
const BUILTIN_TOOL_DEFAULTS: Record<string, { name: string; description: string; icon: string; path: string; sort_order: number }> = {
  date_calc:    { name: "日期计算器", description: "计算日期间隔与前后日期", icon: "🗓️",  path: "/pages/date-calc/date-calc", sort_order: 0 },
  age_calc:     { name: "年龄计算器", description: "生肖星座五行人生阶段一览", icon: "🎂", path: "/pages/age-calc/age-calc",   sort_order: 1 },
  img_compress: { name: "图片压缩",   description: "本地压缩，不上传服务器", icon: "🗜️",  path: "/pages/img-compress/img-compress", sort_order: 2 },
};

function resolveBuiltinPath(bindingPath: string | null | undefined, defaultPath: string): string {
  if (bindingPath && bindingPath !== "#" && bindingPath.trim() !== "") return bindingPath;
  return defaultPath;
}

/** 合并历史错误埋点 key（tool:builtin_xxx → builtin:xxx） */
function normalizeToolClickStats(raw: Record<string, number>): Record<string, number> {
  const stats = { ...raw };
  for (const [page, count] of Object.entries(raw)) {
    const m = page.match(/^tool:builtin_(.+)$/);
    if (m) {
      const key = `builtin:${m[1]}`;
      stats[key] = (stats[key] || 0) + count;
      delete stats[page];
    }
  }
  return stats;
}

// Helper: read all builtin settings from KV
async function readBuiltinSettings() {
  const result = await db.execute(sql`SELECT key, value FROM settings WHERE key LIKE 'tool_%'`);
  const byKey: Record<string, string> = {};
  for (const r of result.rows as { key: string; value: string }[]) byKey[r.key] = r.value;
  return byKey;
}

// ── Admin: GET /api/mp-tools/builtin/admin ────────────────────────────────────
router.get("/builtin/admin", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const byKey = await readBuiltinSettings();
    const bindingsResult = await db.execute(sql`SELECT * FROM mp_tool_app_bindings WHERE builtin_name IS NOT NULL`);
    const allBindings = bindingsResult.rows as any[];

    const tools = Object.entries(BUILTIN_TOOL_DEFAULTS).map(([key, defaults]) => ({
      builtin_name: key,
      name: byKey[`tool_${key}_name`] || defaults.name,
      description: byKey[`tool_${key}_description`] || defaults.description,
      icon: byKey[`tool_${key}_icon`] || defaults.icon,
      path: defaults.path,
      sort_order: byKey[`tool_${key}_sort_order`] !== undefined ? Number(byKey[`tool_${key}_sort_order`]) : defaults.sort_order,
      enabled: byKey[`tool_${key}_enabled`] !== "false",
      bindings: allBindings.filter((b: any) => b.builtin_name === key),
    }));
    res.json(tools);
  } catch (err) {
    req.log.error({ err }, "Failed to load builtin tools admin");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Public: GET /api/mp-tools/builtin ─────────────────────────────────────────
router.get("/builtin", async (req: Request, res: Response) => {
  try {
    const appKey = resolveAppKey(req);
    const byKey = await readBuiltinSettings();

    const bindingResult = await db.execute(sql`SELECT * FROM mp_tool_app_bindings WHERE app_key = ${appKey} AND builtin_name IS NOT NULL`);
    const bindingsByName: Record<string, any> = {};
    for (const b of bindingResult.rows as any[]) bindingsByName[b.builtin_name] = b;

    const resolve = (builtinName: string) => {
      const defaults = BUILTIN_TOOL_DEFAULTS[builtinName];
      const binding = bindingsByName[builtinName];
      const globalEnabled = byKey[`tool_${builtinName}_enabled`] !== "false";
      const icon = byKey[`tool_${builtinName}_icon`] || defaults?.icon || null;
      const name = byKey[`tool_${builtinName}_name`] || defaults?.name || builtinName;
      const description = byKey[`tool_${builtinName}_description`] || defaults?.description || "";
      let enabled: boolean;
      if (binding) {
        enabled = binding.enabled !== false && globalEnabled;
      } else if (appKey === "birthday_mp") {
        enabled = globalEnabled;
      } else {
        enabled = false;
      }
      return { enabled, icon, name, description };
    };

    const dateCalc = resolve("date_calc");
    const ageCalc = resolve("age_calc");
    const imgCompress = resolve("img_compress");

    res.json({
      date_calc: dateCalc.enabled,
      date_calc_icon: dateCalc.icon,
      date_calc_name: dateCalc.name,
      date_calc_description: dateCalc.description,
      age_calc: ageCalc.enabled,
      age_calc_icon: ageCalc.icon,
      age_calc_name: ageCalc.name,
      age_calc_description: ageCalc.description,
      img_compress: imgCompress.enabled,
      img_compress_icon: imgCompress.icon,
      img_compress_name: imgCompress.name,
      img_compress_description: imgCompress.description,
    });
  } catch {
    res.json({ date_calc: true, date_calc_icon: null });
  }
});

// ── Admin: PUT /api/mp-tools/builtin/:name ────────────────────────────────────
router.put("/builtin/:name", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const builtinName = req.params.name;
  const { enabled, icon, display_name, description, sort_order, bindings } = req.body as {
    enabled?: boolean; icon?: string; display_name?: string; description?: string;
    sort_order?: number; app_key?: string;
    bindings?: { app_key: string; path: string; category_id?: number | null; enabled?: boolean }[];
  };
  const prefix = "tool_";
  try {
    const upsert = async (suffix: string, value: string) => {
      const key = `${prefix}${builtinName}_${suffix}`;
      await db.execute(sql`
        INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, now())
        ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = now()
      `);
    };
    if (enabled !== undefined) await upsert("enabled", String(enabled));
    if (icon !== undefined) await upsert("icon", icon);
    if (display_name !== undefined) await upsert("name", display_name);
    if (description !== undefined) await upsert("description", description);
    if (sort_order !== undefined) await upsert("sort_order", String(sort_order));

    if (Array.isArray(bindings)) {
      await db.execute(sql`DELETE FROM mp_tool_app_bindings WHERE builtin_name = ${builtinName}`);
      for (const b of bindings) {
        if (!b.app_key) continue;
        await db.execute(sql`
          INSERT INTO mp_tool_app_bindings (builtin_name, app_key, path, category_id, enabled)
          VALUES (${builtinName}, ${b.app_key}, ${b.path || ""}, ${b.category_id ?? null}, ${b.enabled !== false})
        `);
      }
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

// ── Public: GET /api/mp-tools/public-stats ───────────────────────────────────
router.get("/public-stats", async (req: Request, res: Response) => {
  try {
    const appKey = resolveAppKey(req);
    const rows = await db.execute(sql`
      SELECT page, COUNT(*)::int AS count
      FROM analytics_events
      WHERE event_type = 'tool_click'
        AND page IS NOT NULL
        AND app_key = ${appKey}
      GROUP BY page
    `);
    const stats: Record<string, number> = {};
    for (const r of rows.rows as { page: string; count: number }[]) {
      stats[r.page] = Number(r.count);
    }
    res.json(normalizeToolClickStats(stats));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: GET /api/mp-tools/stats ───────────────────────────────────────────
router.get("/stats", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const appKey = typeof req.query.app_key === "string" ? req.query.app_key : "";
    const appFilter = appKey ? sql`AND app_key = ${appKey}` : sql``;
    const rows = await db.execute(sql`
      SELECT page, COUNT(*)::int AS count
      FROM analytics_events
      WHERE event_type = 'tool_click'
        AND page IS NOT NULL
        ${appFilter}
      GROUP BY page
    `);
    const stats: Record<string, number> = {};
    for (const r of rows.rows as { page: string; count: number }[]) {
      stats[r.page] = Number(r.count);
    }
    res.json(normalizeToolClickStats(stats));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
