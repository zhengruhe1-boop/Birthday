import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

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

// ── Public: GET /api/mp-tools ─────────────────────────────────────────────────
// Returns only enabled tools, ordered by sort_order
router.get("/", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT id, name, description, icon, type, path, app_id, page_path, sort_order
      FROM mp_tools
      WHERE enabled = true
      ORDER BY sort_order ASC, id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: GET /api/mp-tools/admin ────────────────────────────────────────────
router.get("/admin", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await db.execute(sql`
      SELECT * FROM mp_tools ORDER BY sort_order ASC, id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: POST /api/mp-tools/admin ───────────────────────────────────────────
router.post("/admin", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { name, description = "", icon = "🔧", type = "internal", path = "", app_id = "", page_path = "", enabled = true } = req.body as {
      name: string; description?: string; icon?: string; type?: string;
      path?: string; app_id?: string; page_path?: string; enabled?: boolean;
    };
    if (!name) return void res.status(400).json({ error: "name is required" });

    const maxOrderResult = await db.execute(sql`SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM mp_tools`);
    const maxOrder = Number((maxOrderResult.rows[0] as any)?.max_order ?? -1);

    const result = await db.execute(sql`
      INSERT INTO mp_tools (name, description, icon, type, path, app_id, page_path, sort_order, enabled)
      VALUES (${name}, ${description}, ${icon}, ${type}, ${path}, ${app_id}, ${page_path}, ${maxOrder + 1}, ${enabled})
      RETURNING *
    `);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: PUT /api/mp-tools/admin/:id ────────────────────────────────────────
router.put("/admin/:id", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description, icon, type, path, app_id, page_path, enabled } = req.body as {
      name?: string; description?: string; icon?: string; type?: string;
      path?: string; app_id?: string; page_path?: string; enabled?: boolean;
    };

    const result = await db.execute(sql`
      UPDATE mp_tools SET
        name        = COALESCE(${name ?? null}, name),
        description = COALESCE(${description ?? null}, description),
        icon        = COALESCE(${icon ?? null}, icon),
        type        = COALESCE(${type ?? null}, type),
        path        = COALESCE(${path ?? null}, path),
        app_id      = COALESCE(${app_id ?? null}, app_id),
        page_path   = COALESCE(${page_path ?? null}, page_path),
        enabled     = COALESCE(${enabled ?? null}, enabled)
      WHERE id = ${id}
      RETURNING *
    `);
    if (!result.rows.length) return void res.status(404).json({ error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
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
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Admin: PUT /api/mp-tools/admin/reorder ────────────────────────────────────
// Body: { ids: number[] } — ordered array of tool IDs
router.put("/admin/reorder", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids)) return void res.status(400).json({ error: "ids must be an array" });
    for (let i = 0; i < ids.length; i++) {
      await db.execute(sql`UPDATE mp_tools SET sort_order = ${i} WHERE id = ${ids[i]}`);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
