import { Router, type IRouter } from "express";
import { db, usersTable, contactsTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth.js";
import { settingsTable } from "@workspace/db";

const router: IRouter = Router();

async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function getQuotaStatus(userId: number) {
  const limitStr = await getSetting("quota_limit");
  const limit = parseInt(limitStr || "0") || 0;
  const action = (await getSetting("quota_action")) || "share";
  const perActionStr = await getSetting("quota_per_action");
  const perAction = parseInt(perActionStr || "5") || 5;
  const videoAdId = (await getSetting("quota_video_ad_id")) || "";
  const mpAppId = (await getSetting("quota_mp_appid")) || "";
  const mpPath = (await getSetting("quota_mp_path")) || "";
  const mpName = (await getSetting("quota_mp_name")) || "";

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const extraQuota = user?.extraQuota ?? 0;

  // ── 只统计配额开启后添加的联系人 ─────────────────────────────────────────
  const enabledAt = await getSetting("quota_enabled_at");
  const whereClause = enabledAt
    ? and(eq(contactsTable.userId, userId), gte(contactsTable.createdAt, new Date(enabledAt)))
    : eq(contactsTable.userId, userId);

  const contacts = await db.select({ id: contactsTable.id }).from(contactsTable).where(whereClause);
  const count = contacts.length;

  let remaining: number | null = null;
  if (limit > 0) {
    remaining = Math.max(0, limit + extraQuota - count);
  }

  return { limit, action, perAction, videoAdId, mpAppId, mpPath, mpName, count, extraQuota, remaining };
}

router.use(requireAuth);

// ── GET /api/quota/config ─────────────────────────────────────────────────────
router.get("/config", async (req: AuthRequest, res) => {
  try {
    const status = await getQuotaStatus(req.userId!);
    res.json(status);
  } catch (err) {
    req.log.error({ err }, "Get quota config error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/quota/claim ─────────────────────────────────────────────────────
router.post("/claim", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { action } = req.body as { action?: string };

    const configAction = (await getSetting("quota_action")) || "share";
    if (!action || action !== configAction) {
      res.status(400).json({ error: "Invalid action type" });
      return;
    }

    const perActionStr = await getSetting("quota_per_action");
    const perAction = parseInt(perActionStr || "5") || 5;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const currentExtra = user?.extraQuota ?? 0;

    await db.update(usersTable)
      .set({ extraQuota: currentExtra + perAction })
      .where(eq(usersTable.id, userId));

    const status = await getQuotaStatus(userId);
    res.json({ success: true, added: perAction, ...status });
  } catch (err) {
    req.log.error({ err }, "Claim quota error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
