import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, contactsTable, settingsTable, eventsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

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
    const allUsers = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
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
        oaOpenId: u.oaOpenId,
        mpSubscribed: u.mpSubscribed,
        unionId: u.unionId,
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
      totalEntries: totalContacts + totalEvents,
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

    // 检查环境变量是否覆盖了数据库设置（使用小程序专用名称，避免与公众号通用变量冲突）
    const mpAppIdEnv     = process.env.WECHAT_MP_APPID     || "";
    const mpAppSecretEnv = process.env.WECHAT_MP_APP_SECRET || "";

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
    const { enabled, daysBefore, sendHour, templateId, h5Url } = req.body as {
      enabled?:    boolean;
      daysBefore?: number[];
      sendHour?:   number;
      templateId?: string;
      h5Url?:      string;
    };

    if (enabled !== undefined)    await setSetting("notify_enabled",     String(enabled));
    if (daysBefore !== undefined) await setSetting("notify_days_before", daysBefore.map(String).join(","));
    if (sendHour !== undefined)   await setSetting("notify_send_hour",   String(sendHour));
    if (templateId !== undefined) await setSetting("notify_template_id", templateId.trim());
    if (h5Url !== undefined)      await setSetting("notify_h5_url",      h5Url.trim());

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

// ── POST /api/admin/oa-sync ───────────────────────────────────────────────────
// 手动触发：扫描公众号关注列表，通过 unionId 回填 oaOpenId（适合历史关注者）
router.post("/oa-sync", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { getAccessToken, syncOaOpenIds } = await import("../lib/wechat-notify.js");
    const token = await getAccessToken();
    if (!token) {
      res.status(400).json({ error: "无法获取公众号 access_token，请检查 AppID / AppSecret 配置" });
      return;
    }
    const result = await syncOaOpenIds(token);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/admin/oa-diagnostic ─────────────────────────────────────────────
// 诊断公众号通知链路所有关键步骤，帮助排查问题
router.get("/oa-diagnostic", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { getAccessToken } = await import("../lib/wechat-notify.js");
    const { usersTable: ut } = await import("@workspace/db");

    const report: Record<string, unknown> = {};

    // 1. 配置检查
    const oaAppId     = await getSetting("wechat_appid");
    const oaAppSecret = await getSetting("wechat_appsecret");
    const templateId  = await getSetting("notify_template_id");
    const enabled     = await getSetting("notify_enabled");
    report.config = {
      oaAppId:          oaAppId   ? oaAppId.slice(0, 6) + "***" : null,
      oaAppSecretSet:   !!oaAppSecret,
      templateId:       templateId ?? "iKiueM36DMAWXrO4VQMK68ulAFDz_51ylIBZt_AMw9w (default)",
      notifyEnabled:    enabled !== "false",
    };

    // 2. Access token
    const token = await getAccessToken();
    report.accessToken = token ? "OK (obtained)" : "FAILED (check AppID/AppSecret and IP whitelist)";

    // 3. 用户数据状态
    const { db } = await import("@workspace/db");
    const allUsers      = await db.select({ id: ut.id, openId: ut.openId, unionId: ut.unionId, oaOpenId: ut.oaOpenId })
                            .from(ut);
    const mpUsers       = allUsers.filter(u => u.openId && !u.openId.startsWith("mock:"));
    const withUnionId   = mpUsers.filter(u => u.unionId);
    const withOaOpenId  = allUsers.filter(u => u.oaOpenId);
    report.users = {
      totalInDB:           allUsers.length,
      realMpUsers:         mpUsers.length,
      mpUsersWithUnionId:  withUnionId.length,
      usersWithOaOpenId:   withOaOpenId.length,
      sampleOaOpenIds:     withOaOpenId.slice(0, 3).map(u => ({ id: u.id, oaOpenId: u.oaOpenId?.slice(0, 8) + "…" })),
    };

    // 4. 如果有 token，尝试拉关注列表（只看第一页）
    if (token) {
      try {
        const url = `https://api.weixin.qq.com/cgi-bin/user/get?access_token=${token}`;
        const resp = await fetch(url);
        const data = await resp.json() as { total?: number; count?: number; errcode?: number; errmsg?: string };
        if (data.errcode) {
          report.oaFollowerList = { error: `errcode ${data.errcode}: ${data.errmsg}` };
        } else {
          report.oaFollowerList = { total: data.total, firstPageCount: data.count };
        }
      } catch (e: any) {
        report.oaFollowerList = { error: String(e?.message) };
      }
    } else {
      report.oaFollowerList = "skipped (no access token)";
    }

    // 5. 最近一次通知结果
    const lastRun    = await getSetting("notify_mp_last_run");
    const lastResult = await getSetting("notify_mp_last_result");
    report.lastNotifyRun = {
      at:     lastRun ?? "never",
      result: lastResult ? JSON.parse(lastResult) : null,
    };

    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message), stack: String(err?.stack).slice(0, 500) });
  }
});

// ── POST /api/admin/oa-send-test ──────────────────────────────────────────────
// 直接向指定 OA openId 发一条测试模板消息
router.post("/oa-send-test", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { oaOpenId, name, date } = req.body as { oaOpenId?: string; name?: string; date?: string };
    if (!oaOpenId) {
      res.status(400).json({ error: "oaOpenId is required" });
      return;
    }
    const { getAccessToken } = await import("../lib/wechat-notify.js");
    const token = await getAccessToken();
    if (!token) {
      res.status(400).json({ error: "无法获取 OA access_token" });
      return;
    }
    const templateId = (await getSetting("notify_template_id")) ?? "iKiueM36DMAWXrO4VQMK68ulAFDz_51ylIBZt_AMw9w";
    const h5Url = await getSetting("notify_h5_url");
    const payload: Record<string, unknown> = {
      touser:      oaOpenId,
      template_id: templateId,
      // miniprogram 字段已移除：小程序与公众号未绑定时 WeChat 返回 40165 拒绝整条消息
      data: {
        thing19: { value: (name ?? "测试用户 · 生日").slice(0, 20) },
        time24:  { value: (date ?? new Date().toISOString().slice(0, 10)) + " 00:00" },
      },
    };
    if (h5Url) payload.url = h5Url;
    const res2 = await fetch(
      `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    const data = await res2.json();
    res.json({ payload: { touser: oaOpenId, templateId }, wechatResponse: data });
  } catch (err: any) {
    res.status(500).json({ error: String(err?.message) });
  }
});

// ── POST /api/admin/oa-link-user ──────────────────────────────────────────────
// 手动将一个 OA openId 关联到指定用户（当自动 sync 无法运行时的备用方案）
router.post("/oa-link-user", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { userId, oaOpenId } = req.body as { userId?: number; oaOpenId?: string };
    if (!userId || !oaOpenId) {
      res.status(400).json({ error: "userId and oaOpenId are required" });
      return;
    }
    const updated = await db.update(usersTable)
      .set({ oaOpenId: oaOpenId.trim() })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, oaOpenId: usersTable.oaOpenId });
    if (updated.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ success: true, userId: updated[0].id, oaOpenId: updated[0].oaOpenId });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/admin/oa-users ───────────────────────────────────────────────────
// 返回所有真实微信用户及其 OA 关联状态（用于排查发不出通知的问题）
router.get("/oa-users", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const users = await db.select({
      id: usersTable.id,
      nickname: usersTable.nickname,
      openId: usersTable.openId,
      unionId: usersTable.unionId,
      oaOpenId: usersTable.oaOpenId,
      createdAt: usersTable.createdAt,
      lastAccessAt: usersTable.lastAccessAt,
    }).from(usersTable).orderBy(desc(usersTable.createdAt));

    const result = users.map(u => ({
      id: u.id,
      nickname: u.nickname,
      isMock: !u.openId || u.openId.startsWith("mock:"),
      isOaOnly: !u.openId,
      hasUnionId: !!u.unionId,
      hasOaOpenId: !!u.oaOpenId,
      oaOpenIdPreview: u.oaOpenId ? u.oaOpenId.slice(0, 8) + "…" : null,
      createdAt: u.createdAt,
      lastAccessAt: u.lastAccessAt,
    }));

    const stats = {
      total: result.length,
      realMpUsers: result.filter(u => !u.isMock && !u.isOaOnly).length,
      oaOnlyPlaceholders: result.filter(u => u.isOaOnly).length,
      withUnionId: result.filter(u => u.hasUnionId && !u.isMock).length,
      withOaOpenId: result.filter(u => u.hasOaOpenId && !u.isOaOnly).length,
      readyToNotify: result.filter(u => u.hasOaOpenId && !u.isOaOnly).length,
    };

    res.json({ stats, users: result });
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

