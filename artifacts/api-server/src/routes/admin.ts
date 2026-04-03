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
// Query params: page (1-based, default 1), pageSize (default 12)
router.get("/stats", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const PAGE_SIZE = 10;
    const page     = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const offset   = (page - 1) * PAGE_SIZE;

    // Total count
    const allUsers = await db.select().from(usersTable).orderBy(usersTable.createdAt);
    const totalUsers = allUsers.length;

    // Paginated users
    const users = allUsers.slice(offset, offset + PAGE_SIZE);

    const allContacts = await db.select().from(contactsTable).orderBy(contactsTable.createdAt);
    const totalContacts = allContacts.length;

    // Only attach contacts for users on this page
    const userIds = new Set(users.map(u => u.id));
    const pageContacts = allContacts.filter(c => userIds.has(c.userId!));

    const result = users.map((u) => {
      const userContacts = pageContacts.filter((c) => c.userId === u.id).map((c) => ({
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
        lastAccessAt: u.lastAccessAt,
        contactCount: userContacts.length,
        contacts: userContacts,
      };
    });

    res.json({
      totalUsers,
      totalContacts,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(totalUsers / PAGE_SIZE),
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
    const loginMode  = await getSetting("login_mode") ?? "mock";
    res.json({
      appId:       appId    ?? "",
      appSecret:   appSecret ? "••••••••" : "",
      appSecretSet: !!appSecret,
      domain:      domain   ?? "",
      loginMode,   // "wechat" | "mock"
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/admin/wechat-config ──────────────────────────────────────────────
router.put("/wechat-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { appId, appSecret, domain, loginMode } = req.body as {
      appId?: string;
      appSecret?: string;
      domain?: string;
      loginMode?: string;
    };

    if (appId !== undefined)    await setSetting("wechat_appid",           appId.trim());
    if (appSecret && !appSecret.startsWith("•")) {
      await setSetting("wechat_appsecret", appSecret.trim());
    }
    if (domain !== undefined)   await setSetting("wechat_callback_domain", domain.trim());
    if (loginMode === "wechat" || loginMode === "mock") {
      await setSetting("login_mode", loginMode);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/admin/content-config ─────────────────────────────────────────────
router.get("/content-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const terms   = await getSetting("terms_of_service");
    const privacy = await getSetting("privacy_policy");
    res.json({
      termsOfService: terms   ?? "",
      privacyPolicy:  privacy ?? "",
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/admin/content-config ─────────────────────────────────────────────
router.put("/content-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { termsOfService, privacyPolicy } = req.body as {
      termsOfService?: string;
      privacyPolicy?: string;
    };
    if (termsOfService !== undefined) await setSetting("terms_of_service", termsOfService);
    if (privacyPolicy  !== undefined) await setSetting("privacy_policy",   privacyPolicy);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/admin/ai-config ──────────────────────────────────────────────────
router.get("/ai-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { getAiConfig } = await import("../lib/birthday-events.js");
    res.json(await getAiConfig());
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/admin/ai-config ──────────────────────────────────────────────────
router.put("/ai-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { enabled, provider, model, apiKeyCustom, temperature } = req.body as {
      enabled?:      boolean;
      provider?:     string;
      model?:        string;
      apiKeyCustom?: string;
      temperature?:  number;
    };

    if (enabled    !== undefined) await setSetting("ai_enabled",        String(enabled));
    if (provider   !== undefined) await setSetting("ai_provider",       provider.trim());
    if (model      !== undefined) await setSetting("ai_model",          model.trim());
    if (apiKeyCustom !== undefined && !apiKeyCustom.startsWith("•")) {
      await setSetting("ai_api_key_custom", apiKeyCustom.trim());
    }
    if (temperature !== undefined) await setSetting("ai_temperature",   String(temperature));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/admin/ai-test ────────────────────────────────────────────────────
router.post("/ai-test", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { testAiConnection } = await import("../lib/birthday-events.js");
    const result = await testAiConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/admin/notify-config ──────────────────────────────────────────────
router.get("/notify-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { getNotifyConfig } = await import("../lib/wechat-notify.js");
    res.json(await getNotifyConfig());
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/admin/notify-config ──────────────────────────────────────────────
router.put("/notify-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { enabled, daysBefore, sendHour, templateId, varName, varDate, varDays } = req.body as {
      enabled?:    boolean;
      daysBefore?: number[];
      sendHour?:   number;
      templateId?: string;
      varName?:    string;
      varDate?:    string;
      varDays?:    string;
    };

    if (enabled !== undefined) await setSetting("notify_enabled", String(enabled));
    if (daysBefore !== undefined) await setSetting("notify_days_before", daysBefore.map(String).join(","));
    if (sendHour !== undefined)   await setSetting("notify_send_hour",   String(sendHour));
    if (templateId !== undefined) await setSetting("notify_template_id", templateId.trim());
    if (varName !== undefined)    await setSetting("notify_var_name",    varName.trim());
    if (varDate !== undefined)    await setSetting("notify_var_date",    varDate.trim());
    if (varDays !== undefined)    await setSetting("notify_var_days",    varDays.trim());

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/admin/notify-run ────────────────────────────────────────────────
router.post("/notify-run", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { runWechatBirthdayNotifications } = await import("../lib/wechat-notify.js");
    const result = await runWechatBirthdayNotifications();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export { getSetting };
export default router;
