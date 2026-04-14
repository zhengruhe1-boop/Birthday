import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, contactsTable, settingsTable, eventsTable } from "@workspace/db";
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

    const allEvents = await db.select().from(eventsTable);
    const totalEvents = allEvents.length;

    // Only attach contacts/events for users on this page
    const userIds = new Set(users.map(u => u.id));
    const pageContacts = allContacts.filter(c => userIds.has(c.userId!));
    const pageEvents   = allEvents.filter(e => userIds.has(e.userId));

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
      const userEventCount = pageEvents.filter(e => e.userId === u.id).length;
      return {
        id: u.id,
        openId: u.openId,
        nickname: u.nickname,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt,
        lastAccessAt: u.lastAccessAt,
        contactCount: userContacts.length,
        eventCount: userEventCount,
        contacts: userContacts,
      };
    });

    res.json({
      totalUsers,
      totalContacts,
      totalEvents,
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
    // ── 公众号（H5 OAuth）配置 ───────────────────────────────────────────────
    const oaAppId       = await getSetting("wechat_appid");
    const oaAppSecret   = await getSetting("wechat_appsecret");
    const oaDomain      = await getSetting("wechat_callback_domain");
    const oaAccountName = await getSetting("wechat_account_name") ?? "";
    const serverToken   = await getSetting("wechat_server_token") ?? "";

    // ── 小程序（Mini Program jscode2session）配置 ────────────────────────────
    const mpAppIdDb     = await getSetting("wechat_mp_appid");
    const mpAppSecretDb = await getSetting("wechat_mp_appsecret");

    // 检查环境变量是否覆盖了数据库设置
    const mpAppIdEnv     = process.env.WECHAT_APPID     || "";
    const mpAppSecretEnv = process.env.WECHAT_APP_SECRET || "";

    // 实际生效的值（与 auth.ts wechat/login 保持一致的优先级）
    const mpAppIdActive     = mpAppIdEnv     || mpAppIdDb     || "";
    const mpAppSecretActive = mpAppSecretEnv || mpAppSecretDb || "";

    // ── 登录模式 ─────────────────────────────────────────────────────────────
    // h5LoginMode:   "wechat_oa" | "mock"
    // mpLoginMode:   "wechat_mp" | "mock"
    const rawMode     = await getSetting("login_mode") ?? "mock";
    // Backward-compat: old "wechat" → "wechat_oa"
    const h5LoginMode = rawMode === "wechat" ? "wechat_oa" : rawMode as "wechat_oa" | "mock";
    const mpLoginMode = (await getSetting("login_mode_mp") ?? "mock") as "wechat_mp" | "mock";

    res.json({
      // Public Account (OA)
      oaAppId:        oaAppId      ?? "",
      oaAppSecret:    oaAppSecret  ? "••••••••" : "",
      oaAppSecretSet: !!oaAppSecret,
      oaDomain:       oaDomain     ?? "",
      oaAccountName,
      serverToken,
      // Mini Program (MP) — 数据库中保存的值
      mpAppId:        mpAppIdDb      ?? "",
      mpAppSecret:    mpAppSecretDb  ? "••••••••" : "",
      mpAppSecretSet: !!mpAppSecretDb,
      // 实际生效的 AppID（用于 UI 展示对比）
      mpAppIdActive,
      mpAppSecretActive: mpAppSecretActive ? "••••••••" : "",
      // 来源标识：env = 环境变量覆盖，db = 数据库，none = 未配置
      mpAppIdSource:     mpAppIdEnv ? "env" : (mpAppIdDb ? "db" : "none"),
      mpAppSecretSource: mpAppSecretEnv ? "env" : (mpAppSecretDb ? "db" : "none"),
      // Login modes
      h5LoginMode,
      mpLoginMode,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/admin/wechat-config ──────────────────────────────────────────────
router.put("/wechat-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const {
      // OA fields
      oaAppId, oaAppSecret, oaDomain, oaAccountName, serverToken,
      // MP fields
      mpAppId, mpAppSecret,
      // modes
      h5LoginMode, mpLoginMode,
    } = req.body as {
      oaAppId?:       string;
      oaAppSecret?:   string;
      oaDomain?:      string;
      oaAccountName?: string;
      serverToken?:   string;
      mpAppId?:       string;
      mpAppSecret?:   string;
      h5LoginMode?:   string;
      mpLoginMode?:   string;
    };

    // OA
    if (oaAppId       !== undefined) await setSetting("wechat_appid",           oaAppId.trim());
    if (oaAppSecret && !oaAppSecret.startsWith("•")) {
      await setSetting("wechat_appsecret", oaAppSecret.trim());
    }
    if (oaDomain      !== undefined) await setSetting("wechat_callback_domain",  oaDomain.trim());
    if (oaAccountName !== undefined) await setSetting("wechat_account_name",     oaAccountName.trim());
    if (serverToken   !== undefined) await setSetting("wechat_server_token",     serverToken.trim());

    // MP
    if (mpAppId !== undefined)  await setSetting("wechat_mp_appid",   mpAppId.trim());
    if (mpAppSecret && !mpAppSecret.startsWith("•")) {
      await setSetting("wechat_mp_appsecret", mpAppSecret.trim());
    }

    // Modes
    if (h5LoginMode === "wechat_oa" || h5LoginMode === "mock") {
      await setSetting("login_mode", h5LoginMode);
    }
    if (mpLoginMode === "wechat_mp" || mpLoginMode === "mock") {
      await setSetting("login_mode_mp", mpLoginMode);
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
    const { enabled, daysBefore, sendHour, templateId } = req.body as {
      enabled?:    boolean;
      daysBefore?: number[];
      sendHour?:   number;
      templateId?: string;
    };

    if (enabled !== undefined)    await setSetting("notify_enabled",     String(enabled));
    if (daysBefore !== undefined) await setSetting("notify_days_before", daysBefore.map(String).join(","));
    if (sendHour !== undefined)   await setSetting("notify_send_hour",   String(sendHour));
    if (templateId !== undefined) await setSetting("notify_template_id", templateId.trim());

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

// ── GET /api/admin/mp-notify-config ───────────────────────────────────────────
router.get("/mp-notify-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { getMpNotifyConfig } = await import("../lib/wechat-mp-notify.js");
    res.json(await getMpNotifyConfig());
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/admin/mp-notify-config ───────────────────────────────────────────
router.put("/mp-notify-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { enabled, templateId, daysBefore, sendHour, tipText } = req.body as {
      enabled?:    boolean;
      templateId?: string;
      daysBefore?: number[];
      sendHour?:   number;
      tipText?:    string;
    };
    if (enabled !== undefined)    await setSetting("mp_notify_enabled",      String(enabled));
    if (templateId !== undefined) await setSetting("mp_notify_template_id",  templateId.trim());
    if (daysBefore !== undefined) await setSetting("mp_notify_days_before",  daysBefore.map(String).join(","));
    if (sendHour !== undefined)   await setSetting("mp_notify_send_hour",    String(sendHour));
    if (tipText !== undefined)    await setSetting("mp_notify_tip_text",     tipText.trim());
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/admin/mp-notify-run ─────────────────────────────────────────────
router.post("/mp-notify-run", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { runMpBirthdayNotifications } = await import("../lib/wechat-mp-notify.js");
    const result = await runMpBirthdayNotifications();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/admin/email-config ───────────────────────────────────────────────
router.get("/email-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { getEmailConfig } = await import("../lib/email.js");
    res.json(await getEmailConfig());
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/admin/email-config ───────────────────────────────────────────────
router.put("/email-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { enabled, smtpHost, smtpPort, smtpSecure, senderEmail, authCode, daysBefore, sendHour } = req.body as {
      enabled?:     boolean;
      smtpHost?:    string;
      smtpPort?:    number;
      smtpSecure?:  boolean;
      senderEmail?: string;
      authCode?:    string;
      daysBefore?:  number[];
      sendHour?:    number;
    };

    if (enabled     !== undefined) await setSetting("email_enabled",     String(enabled));
    if (smtpHost    !== undefined) await setSetting("email_smtp_host",   smtpHost.trim());
    if (smtpPort    !== undefined) await setSetting("email_smtp_port",   String(smtpPort));
    if (smtpSecure  !== undefined) await setSetting("email_smtp_secure", String(smtpSecure));
    if (senderEmail !== undefined) await setSetting("email_sender",      senderEmail.trim());
    // Only update authCode if a non-empty value is provided (blank = keep existing)
    if (authCode !== undefined && authCode.trim() !== "") {
      await setSetting("email_auth_code", authCode.trim());
    }
    if (daysBefore !== undefined) await setSetting("email_days_before", daysBefore.map(String).join(","));
    if (sendHour   !== undefined) await setSetting("email_send_hour",   String(sendHour));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/admin/email-verify ─────────────────────────────────────────────
router.post("/email-verify", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { verifyEmailConfig } = await import("../lib/email.js");
    res.json(await verifyEmailConfig());
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/admin/email-test ────────────────────────────────────────────────
router.post("/email-test", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { toEmail } = req.body as { toEmail?: string };
    if (!toEmail || !toEmail.includes("@")) {
      res.status(400).json({ ok: false, message: "请提供有效的收件邮箱" });
      return;
    }
    const { sendTestEmail } = await import("../lib/email.js");
    res.json(await sendTestEmail(toEmail));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/admin/email-run ─────────────────────────────────────────────────
router.post("/email-run", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { runBirthdayReminders } = await import("../lib/reminder.js");
    const result = await runBirthdayReminders();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/admin/share-config ───────────────────────────────────────────────
router.get("/share-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const title   = await getSetting("share_title")   ?? "";
    const desc    = await getSetting("share_desc")    ?? "";
    const imgUrl  = await getSetting("share_img_url") ?? "";
    const link    = await getSetting("share_link")    ?? "";
    res.json({ title, desc, imgUrl, link });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/admin/share-config ───────────────────────────────────────────────
router.put("/share-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { title, desc, imgUrl, link } = req.body as Record<string, string>;
    if (title   !== undefined) await setSetting("share_title",   title.trim());
    if (desc    !== undefined) await setSetting("share_desc",    desc.trim());
    if (imgUrl  !== undefined) await setSetting("share_img_url", imgUrl.trim());
    if (link    !== undefined) await setSetting("share_link",    link.trim());
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export { getSetting };
export default router;

