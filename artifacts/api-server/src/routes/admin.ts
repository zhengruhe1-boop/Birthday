import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, contactsTable, settingsTable, eventsTable, timeCapsulesTable, analyticsEventsTable } from "@workspace/db";
import { eq, desc, isNull, isNotNull, and, not, like, gte } from "drizzle-orm";

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

    const allCapsules = await db.select().from(timeCapsulesTable);
    const totalCapsules = allCapsules.length;

    // Only attach contacts/events/capsules for users on this page
    const userIds = new Set(users.map(u => u.id));
    const pageContacts = allContacts.filter(c => userIds.has(c.userId!));
    const pageEvents   = allEvents.filter(e => userIds.has(e.userId));
    const pageCapsules = allCapsules.filter(c => userIds.has(c.userId));

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
      const userCapsuleCount = pageCapsules.filter(c => c.userId === u.id).length;
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
        capsuleCount: userCapsuleCount,
        contacts: userContacts,
      };
    });

    res.json({
      totalUsers,
      totalContacts,
      totalEvents,
      totalCapsules,
      totalEntries: totalContacts + totalEvents + totalCapsules,
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

// ── GET /api/admin/fortune-config ─────────────────────────────────────────────
router.get("/fortune-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const model     = await getSetting("fortune_model");
    const apiKey    = await getSetting("fortune_api_key");
    res.json({
      model:     model   ?? "deepseek-chat",
      apiKeySet: !!apiKey,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/admin/fortune-config ──────────────────────────────────────────────
router.put("/fortune-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { model, apiKey } = req.body as { model?: string; apiKey?: string };
    if (model   !== undefined) await setSetting("fortune_model",   model.trim());
    if (apiKey && !apiKey.startsWith("•")) {
      await setSetting("fortune_api_key", apiKey.trim());
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/admin/fortune-test ───────────────────────────────────────────────
router.post("/fortune-test", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const apiKey =
      (await getSetting("fortune_api_key")) ||
      (await getSetting("ai_api_key_custom")) ||
      process.env.DEEPSEEK_API_KEY || "";
    const model = (await getSetting("fortune_model")) || (await getSetting("ai_model")) || "deepseek-chat";
    if (!apiKey) {
      res.json({ ok: false, message: "未配置 API Key" });
      return;
    }
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "你好，请回复【连接成功】四个字。" }],
      max_tokens: 20,
    });
    const reply = completion.choices[0]?.message?.content ?? "";
    res.json({ ok: true, message: `连接成功，模型回复：${reply.slice(0, 30)}` });
  } catch (err: any) {
    res.json({ ok: false, message: err?.message ?? "连接失败" });
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
    const { enabled, provider, model, apiKeyCustom, temperature, filterKeywords } = req.body as {
      enabled?:        boolean;
      provider?:       string;
      model?:          string;
      apiKeyCustom?:   string;
      temperature?:    number;
      filterKeywords?: string[];
    };

    if (enabled    !== undefined) await setSetting("ai_enabled",        String(enabled));
    if (provider   !== undefined) await setSetting("ai_provider",       provider.trim());
    if (model      !== undefined) await setSetting("ai_model",          model.trim());
    if (apiKeyCustom !== undefined && !apiKeyCustom.startsWith("•")) {
      await setSetting("ai_api_key_custom", apiKeyCustom.trim());
    }
    if (temperature !== undefined) await setSetting("ai_temperature",   String(temperature));
    if (filterKeywords !== undefined) {
      await setSetting("ai_filter_keywords", filterKeywords.map(k => k.trim()).filter(Boolean).join(","));
    }

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
    const { enabled, daysBefore, sendHour, templateId, h5Url,
            mpLinkEnabled, mpLinkAppId, mpLinkPagePath } = req.body as {
      enabled?:        boolean;
      daysBefore?:     number[];
      sendHour?:       number;
      templateId?:     string;
      h5Url?:          string;
      mpLinkEnabled?:  boolean;
      mpLinkAppId?:    string;
      mpLinkPagePath?: string;
    };

    if (enabled !== undefined)        await setSetting("notify_enabled",          String(enabled));
    if (daysBefore !== undefined)     await setSetting("notify_days_before",      daysBefore.map(String).join(","));
    if (sendHour !== undefined)       await setSetting("notify_send_hour",        String(sendHour));
    if (templateId !== undefined)     await setSetting("notify_template_id",      templateId.trim());
    if (h5Url !== undefined)          await setSetting("notify_h5_url",           h5Url.trim());
    if (mpLinkEnabled !== undefined)  await setSetting("notify_mp_link_enabled",  String(mpLinkEnabled));
    if (mpLinkAppId !== undefined)    await setSetting("notify_mp_link_appid",    mpLinkAppId.trim());
    if (mpLinkPagePath !== undefined) await setSetting("notify_mp_link_pagepath", mpLinkPagePath.trim().replace(/\.html$/i, ""));

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

// ── POST /api/admin/oa-backfill ───────────────────────────────────────────────
// 将 openId 回填到 oaOpenId（仅针对公众号 H5 OAuth 老用户，他们的 OA openId 存在 openId 列而非 oaOpenId 列）
router.post("/oa-backfill", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    // 找到有 openId（非 mock）但没有 oaOpenId 的用户
    const targets = await db.select({ id: usersTable.id, openId: usersTable.openId })
      .from(usersTable)
      .where(
        and(
          isNotNull(usersTable.openId),
          isNull(usersTable.oaOpenId),
          not(like(usersTable.openId, "mock:%")),
        )
      );

    let backfilled = 0;
    for (const u of targets) {
      await db.update(usersTable)
        .set({ oaOpenId: u.openId })
        .where(eq(usersTable.id, u.id));
      backfilled++;
    }

    res.json({ backfilled, total: targets.length });
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
    const templateId     = (await getSetting("notify_template_id")) ?? "iKiueM36DMAWXrO4VQMK68ulAFDz_51ylIBZt_AMw9w";
    const h5Url          = await getSetting("notify_h5_url");
    const mpLinkEnabled  = (await getSetting("notify_mp_link_enabled")) === "true";
    const mpLinkAppId    = (await getSetting("notify_mp_link_appid")) ?? "wx4afbf7c1e3ae97ae";
    const mpLinkPagePath = ((await getSetting("notify_mp_link_pagepath")) ?? "pages/home/home").replace(/\.html$/i, "");
    const payload: Record<string, unknown> = {
      touser:      oaOpenId,
      template_id: templateId,
      data: {
        thing19: { value: (name ?? "测试用户 · 生日").slice(0, 20) },
        time24:  { value: (date ?? new Date().toISOString().slice(0, 10)) + " 00:00" },
      },
    };
    if (mpLinkEnabled && mpLinkAppId && mpLinkPagePath) {
      payload.miniprogram = { appid: mpLinkAppId, pagepath: mpLinkPagePath };
    } else if (h5Url) {
      payload.url = h5Url;
    }
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

// ── GET /api/admin/quota-config ───────────────────────────────────────────────
router.get("/quota-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const limit      = parseInt(await getSetting("quota_limit")      || "0") || 0;
    const action     = (await getSetting("quota_action"))             || "share";
    const perAction  = parseInt(await getSetting("quota_per_action") || "5") || 5;
    const videoAdId  = (await getSetting("quota_video_ad_id"))        || "";
    const mpAppId    = (await getSetting("quota_mp_appid"))           || "";
    const mpPath     = (await getSetting("quota_mp_path"))            || "";
    const mpName     = (await getSetting("quota_mp_name"))            || "";
    res.json({ limit, action, perAction, videoAdId, mpAppId, mpPath, mpName });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/admin/quota-config ───────────────────────────────────────────────
router.put("/quota-config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { limit, action, perAction, videoAdId, mpAppId, mpPath, mpName } = req.body as {
      limit?:      number;
      action?:     string;
      perAction?:  number;
      videoAdId?:  string;
      mpAppId?:    string;
      mpPath?:     string;
      mpName?:     string;
    };
    if (limit !== undefined) {
      const prevLimitStr = await getSetting("quota_limit");
      const prevLimit = parseInt(prevLimitStr || "0") || 0;
      await setSetting("quota_limit", String(limit));
      // 从0改为非0时，记录开启时间（从此刻起计算新增联系人）
      if (limit > 0 && prevLimit === 0) {
        await setSetting("quota_enabled_at", new Date().toISOString());
      }
      // 关闭配额时，清除开启时间
      if (limit === 0) {
        await setSetting("quota_enabled_at", "");
      }
    }
    if (action    !== undefined) await setSetting("quota_action",      action.trim());
    if (perAction !== undefined) await setSetting("quota_per_action",  String(perAction));
    if (videoAdId !== undefined) await setSetting("quota_video_ad_id", videoAdId.trim());
    if (mpAppId   !== undefined) await setSetting("quota_mp_appid",    mpAppId.trim());
    if (mpPath    !== undefined) await setSetting("quota_mp_path",     mpPath.trim());
    if (mpName    !== undefined) await setSetting("quota_mp_name",     mpName.trim());
    res.json({ success: true });
  } catch {
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

// ── GET /api/admin/analytics ──────────────────────────────────────────────────
router.get("/analytics", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const now = new Date();
    // UTC midnight today
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);

    // Build 30-day label array (UTC dates)
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setUTCDate(d.getUTCDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    function toUTCDay(d: Date | string | null): string {
      if (!d) return "";
      const dt = d instanceof Date ? d : new Date(d);
      return dt.toISOString().slice(0, 10);
    }

    // Pull data in parallel
    const [allUsers, recentContacts, recentEvents, recentCapsules, recentLaunches, totalContacts, totalEvents, totalCapsules] = await Promise.all([
      db.select({ id: usersTable.id, createdAt: usersTable.createdAt, oaOpenId: usersTable.oaOpenId, mpSubscribed: usersTable.mpSubscribed }).from(usersTable),
      db.select({ createdAt: contactsTable.createdAt }).from(contactsTable).where(gte(contactsTable.createdAt, thirtyDaysAgo)),
      db.select({ createdAt: eventsTable.createdAt }).from(eventsTable).where(gte(eventsTable.createdAt, thirtyDaysAgo)),
      db.select({ createdAt: timeCapsulesTable.createdAt }).from(timeCapsulesTable).where(gte(timeCapsulesTable.createdAt, thirtyDaysAgo)),
      db.select({ createdAt: analyticsEventsTable.createdAt })
        .from(analyticsEventsTable)
        .where(and(eq(analyticsEventsTable.eventType, "app_launch"), gte(analyticsEventsTable.createdAt, thirtyDaysAgo))),
      db.select({ id: contactsTable.id }).from(contactsTable),
      db.select({ id: eventsTable.id }).from(eventsTable),
      db.select({ id: timeCapsulesTable.id }).from(timeCapsulesTable),
    ]);

    const todayStr = days[29];
    const weekAgoStr = days[22]; // 7 days ago

    const overview = {
      totalUsers:      allUsers.length,
      newToday:        allUsers.filter(u => toUTCDay(u.createdAt) === todayStr).length,
      newThisWeek:     allUsers.filter(u => toUTCDay(u.createdAt) >= weekAgoStr).length,
      oaFollowers:     allUsers.filter(u => !!u.oaOpenId).length,
      mpSubscribers:   allUsers.filter(u => u.mpSubscribed).length,
      totalContacts:   totalContacts.length,
      totalEvents:     totalEvents.length,
      totalCapsules:   totalCapsules.length,
    };

    const dailyUsers = days.map(date => ({
      date,
      count: allUsers.filter(u => toUTCDay(u.createdAt) === date).length,
    }));

    const dailyContent = days.map(date => ({
      date,
      contacts: recentContacts.filter(c => toUTCDay(c.createdAt) === date).length,
      events:   recentEvents.filter(e => toUTCDay(e.createdAt) === date).length,
      capsules: recentCapsules.filter(c => toUTCDay(c.createdAt) === date).length,
    }));

    const dailyLaunches = days.map(date => ({
      date,
      count: recentLaunches.filter(l => toUTCDay(l.createdAt) === date).length,
    }));

    res.json({ overview, dailyUsers, dailyContent, dailyLaunches });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export { getSetting };
export default router;

