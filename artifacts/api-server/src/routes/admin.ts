import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, contactsTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const key = req.headers["x-admin-key"];
  const adminKey = process.env.ADMIN_KEY || "birthday-admin-2024";
  if (key !== adminKey) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ── helpers ──────────────────────────────────────────────────────────────────
async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  if (existing.length > 0) {
    await db.update(settingsTable)
      .set({ value, updatedAt: new Date() })
      .where(eq(settingsTable.key, key));
  } else {
    await db.insert(settingsTable).values({ key, value });
  }
}

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get("/stats", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    const contacts = await db.select().from(contactsTable).orderBy(contactsTable.createdAt);

    const result = users.map((u) => {
      const userContacts = contacts.filter((c) => c.userId === u.id).map((c) => ({
        id: c.id,
        name: c.name,
        birthdayMonth: c.birthdayMonth,
        birthdayDay: c.birthdayDay,
        birthYear: c.birthYear,
        birthdayLunar: c.birthdayLunar,
        relation: c.relation,
        createdAt: c.createdAt,
      }));
      return {
        id: u.id,
        openId: u.openId,
        nickname: u.nickname,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt,
        contactCount: userContacts.length,
        contacts: userContacts,
      };
    });

    res.json({
      totalUsers: users.length,
      totalContacts: contacts.length,
      users: result,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/admin/wechat-config ──────────────────────────────────────────────
router.get("/wechat-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const appId      = await getSetting("wechat_appid");
    const appSecret  = await getSetting("wechat_appsecret");
    const domain     = await getSetting("wechat_callback_domain");
    res.json({
      appId:    appId    ?? "",
      appSecret: appSecret ? "••••••••" : "",   // mask secret for display
      appSecretSet: !!appSecret,
      domain:   domain   ?? "",
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/admin/wechat-config ──────────────────────────────────────────────
router.put("/wechat-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { appId, appSecret, domain } = req.body as {
      appId?: string;
      appSecret?: string;
      domain?: string;
    };

    if (appId !== undefined)    await setSetting("wechat_appid",           appId.trim());
    // Only overwrite secret if a real value (not placeholder) is provided
    if (appSecret && !appSecret.startsWith("•")) {
      await setSetting("wechat_appsecret", appSecret.trim());
    }
    if (domain !== undefined)   await setSetting("wechat_callback_domain", domain.trim());

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export { getSetting };
export default router;
