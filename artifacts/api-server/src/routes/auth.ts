import express, { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, and, ne, isNotNull, isNull } from "drizzle-orm";
import crypto from "crypto";
import { WechatLoginBody, MockLoginBody } from "@workspace/api-zod";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { getSetting } from "./admin.js";
import { getAccessToken } from "../lib/wechat-notify.js";

const router: IRouter = Router();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ── GET /api/auth/legal ───────────────────────────────────────────────────────
// Public: returns terms of service and privacy policy text
router.get("/legal", async (_req, res) => {
  try {
    const terms   = await getSetting("terms_of_service");
    const privacy = await getSetting("privacy_policy");
    res.json({
      termsOfService: terms   ?? "",
      privacyPolicy:  privacy ?? "",
    });
  } catch {
    res.json({ termsOfService: "", privacyPolicy: "" });
  }
});

// ── GET /api/auth/wechat/public-config ────────────────────────────────────────
// Returns whether WeChat OAuth is configured (no secrets exposed) and login mode
router.get("/wechat/public-config", async (_req, res) => {
  try {
    const appId        = await getSetting("wechat_appid");
    const secret       = await getSetting("wechat_appsecret");
    const domain       = await getSetting("wechat_callback_domain");
    const rawMode      = await getSetting("login_mode") ?? "mock";
    // Normalize: old "wechat" → "wechat_oa"
    const loginMode    = rawMode === "wechat" ? "wechat_oa" : rawMode;
    const accountName  = await getSetting("wechat_account_name") ?? "";
    const notifyEnabled = (await getSetting("notify_enabled")) !== "false";
    const configured = !!(appId && secret && domain);
    res.json({
      configured,
      appId:         configured ? appId : null,
      loginMode,           // "wechat_oa" | "mock"
      accountName,         // 公众号显示名称
      notifyEnabled,       // 是否开启消息通知
    });
  } catch {
    res.json({ configured: false, appId: null, loginMode: "mock", accountName: "", notifyEnabled: false });
  }
});

// ── GET /api/auth/wechat/subscribe-status ────────────────────────────────────
// Checks whether the authenticated user has followed the Official Account.
// Returns { subscribed: boolean, linkedOa: boolean }.
// Linked via unionId: MP user → find OA user → check subscription.
// Falls back to false on any error (non-WeChat users, API failures, etc.).
router.get("/wechat/subscribe-status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(usersTable)
      .where(eq(usersTable.id, req.userId!)).limit(1);
    if (!rows.length) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { openId, unionId } = rows[0];

    // Non-WeChat users (mock accounts) are never subscribed
    if (!openId || openId.startsWith("mock:")) {
      res.json({ subscribed: false, linkedOa: false });
      return;
    }

    const oaToken = await getAccessToken();
    if (!oaToken) {
      req.log.warn("subscribe-status: could not obtain OA access token");
      res.json({ subscribed: false, linkedOa: false });
      return;
    }

    // Helper: check if a given openId follows the OA
    const checkSubscription = async (oid: string) => {
      const url =
        `https://api.weixin.qq.com/cgi-bin/user/info` +
        `?access_token=${oaToken}&openid=${encodeURIComponent(oid)}&lang=zh_CN`;
      const resp = await fetch(url);
      const data = await resp.json() as { subscribe?: number; errcode?: number; errmsg?: string };
      if (data.errcode) return { ok: false, subscribed: false, errcode: data.errcode };
      return { ok: true, subscribed: data.subscribe === 1, errcode: 0 };
    };

    // Step 1: Try current user's openId directly (works if they're already an OA user)
    const direct = await checkSubscription(openId);
    if (direct.ok) {
      // Current openId is valid for the OA → return result + indicate OA is linked
      res.json({ subscribed: direct.subscribed, linkedOa: true });
      return;
    }

    // Step 2: If direct check failed (likely MP openId, not OA openId), find linked OA user via unionId
    if (unionId) {
      const linked = await db.select().from(usersTable)
        .where(and(
          eq(usersTable.unionId, unionId),
          ne(usersTable.id, req.userId!),
          isNotNull(usersTable.openId),
        ))
        .limit(5);

      for (const linkedUser of linked) {
        if (!linkedUser.openId || linkedUser.openId.startsWith("mock:")) continue;
        const result = await checkSubscription(linkedUser.openId);
        if (result.ok) {
          req.log.info({ unionId, linkedOpenId: linkedUser.openId }, "subscribe-status: resolved via unionId");
          res.json({ subscribed: result.subscribed, linkedOa: true });
          return;
        }
      }

      // Found unionId but no linked OA account that works → OA not yet bound
      req.log.info({ unionId }, "subscribe-status: unionId set but no linked OA user found");
      res.json({ subscribed: false, linkedOa: false });
      return;
    }

    // Step 3: No unionId available → OA not bound to this MP account yet
    req.log.warn({ errcode: direct.errcode }, "subscribe-status: direct check failed, no unionId to fall back on");
    res.json({ subscribed: false, linkedOa: false });
  } catch (err) {
    req.log.error({ err }, "subscribe-status error");
    res.json({ subscribed: false, linkedOa: false });
  }
});

// ── GET /api/auth/wechat/oauth/callback ───────────────────────────────────────
// WeChat redirects here after user grants authorization
router.get("/wechat/oauth/callback", async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };

  const frontendBase = (await getSetting("wechat_callback_domain")) || "";

  // Helper: redirect errors always to the login page so the error param is visible
  const loginBase = frontendBase.replace(/\/+$/, "");
  const errorRedirect = (code: string) =>
    res.redirect(`${loginBase}/login?wechat_error=${code}`);

  if (!code) {
    return errorRedirect("no_code");
  }

  try {
    const appId     = await getSetting("wechat_appid");
    const appSecret = await getSetting("wechat_appsecret");

    if (!appId || !appSecret) {
      return errorRedirect("not_configured");
    }

    // 1. Exchange code for access_token
    const tokenUrl =
      `https://api.weixin.qq.com/sns/oauth2/access_token` +
      `?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;

    const tokenResp = await fetch(tokenUrl);
    const tokenData = await tokenResp.json() as {
      access_token?: string;
      openid?: string;
      errcode?: number;
      errmsg?: string;
    };

    if (tokenData.errcode || !tokenData.access_token || !tokenData.openid) {
      return errorRedirect("token_failed");
    }

    // 2. Get user info
    const infoUrl =
      `https://api.weixin.qq.com/sns/userinfo` +
      `?access_token=${tokenData.access_token}&openid=${tokenData.openid}&lang=zh_CN`;

    const infoResp = await fetch(infoUrl);
    const infoData = await infoResp.json() as {
      openid?: string;
      unionid?: string;
      nickname?: string;
      headimgurl?: string;
      errcode?: number;
    };

    if (infoData.errcode || !infoData.openid) {
      return errorRedirect("userinfo_failed");
    }

    const openId   = infoData.openid;
    const oaUnionId = infoData.unionid || null;
    const nickname = infoData.nickname || "微信用户";
    const avatar   = infoData.headimgurl || null;
    const token    = generateToken();

    // 3. Upsert user (OA openId)
    const existing = await db.select().from(usersTable)
      .where(eq(usersTable.openId, openId)).limit(1);

    const unionIdUpdate = oaUnionId ? { unionId: oaUnionId } : {};
    if (existing.length > 0) {
      // 同时回填 oaOpenId（旧用户可能只有 openId 没有 oaOpenId）
      const oaOpenIdUpdate = existing[0].oaOpenId ? {} : { oaOpenId: openId };
      await db.update(usersTable)
        .set({ sessionToken: token, nickname, avatarUrl: avatar, ...unionIdUpdate, ...oaOpenIdUpdate })
        .where(eq(usersTable.openId, openId));
    } else {
      await db.insert(usersTable).values({ openId, oaOpenId: openId, unionId: oaUnionId || undefined, nickname, avatarUrl: avatar, sessionToken: token });
    }

    // 4. Redirect to frontend LOGIN page with token in URL.
    // Must target /login (not /) because the root route (Home) performs an
    // immediate unauthenticated redirect to /login before Login.tsx can read
    // the token from the URL, causing an infinite OAuth loop.
    const base = frontendBase.replace(/\/+$/, ""); // strip trailing slashes
    const redirectUrl = new URL(base + "/login");
    redirectUrl.searchParams.set("wechat_token", token);
    redirectUrl.searchParams.set("wechat_nickname", encodeURIComponent(nickname));
    if (avatar) redirectUrl.searchParams.set("wechat_avatar", encodeURIComponent(avatar));
    return res.redirect(redirectUrl.toString());

  } catch (err) {
    return errorRedirect("server_error");
  }
});

// ── POST /api/auth/wechat/login (Mini Program jscode2session) ─────────────────
// Falls back to mock-login when WECHAT_MP_APPID / WECHAT_MP_APP_SECRET are not set,
// using a hash of the code as a stable device identifier.
router.post("/wechat/login", async (req, res) => {
  try {
    const body = WechatLoginBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    // Use specific MP env vars (WECHAT_MP_APPID / WECHAT_MP_APP_SECRET) to avoid
    // collision with the generic OA env vars (WECHAT_APPID / WECHAT_APP_SECRET).
    const appId     = process.env.WECHAT_MP_APPID     || (await getSetting("wechat_mp_appid"))     || "";
    const appSecret = process.env.WECHAT_MP_APP_SECRET || (await getSetting("wechat_mp_appsecret")) || "";

    let openId: string;
    let unionId: string | null = null;
    let isMock = false;

    if (appId && appSecret) {
      // ── Real WeChat jscode2session ───────────────────────────────────────────
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${body.data.code}&grant_type=authorization_code`;
      const response = await fetch(url);
      const data = await response.json() as { openid?: string; unionid?: string; session_key?: string; errcode?: number; errmsg?: string };

      if (data.errcode || !data.openid) {
        req.log.error({ data, appId }, "WeChat jscode2session failed");
        // Include errcode so clients can distinguish error types
        res.status(401).json({
          error:   data.errmsg  || "WeChat login failed",
          errcode: data.errcode || 0,
        });
        return;
      }
      openId  = data.openid;
      unionId = data.unionid || null;
    } else {
      // ── Fallback: use sha256(code) as stable pseudo-openid ──────────────────
      openId = "mock:" + crypto.createHash("sha256").update(body.data.code).digest("hex").slice(0, 24);
      isMock = true;
      req.log.info({ openId }, "WeChat MP not configured – using mock openId");
    }

    const existingUsers = await db.select().from(usersTable).where(eq(usersTable.openId, openId)).limit(1);

    let user;
    const unionIdUpdate = unionId ? { unionId } : {};

    if (existingUsers.length > 0) {
      // 老用户：保留现有 sessionToken（避免多端/冷启动互相覆盖），仅当 token 为空时才生成新的
      const keepToken = existingUsers[0].sessionToken || generateToken();
      const updated = await db.update(usersTable)
        .set({ sessionToken: keepToken, lastAccessAt: new Date(), ...unionIdUpdate })
        .where(eq(usersTable.openId, openId))
        .returning();
      user = updated[0];
    } else {
      // 新用户：生成新 token
      const newToken = generateToken();
      const inserted = await db.insert(usersTable).values({
        openId,
        unionId: unionId || undefined,
        nickname: "微信用户",
        sessionToken: newToken,
      }).returning();
      user = inserted[0];
    }

    // ── 登录后关联 OA 占位行 ──────────────────────────────────────────────────
    // 如果 MP 用户有 unionId 但尚无 oaOpenId，尝试从占位行中查找并合并
    // 这可以修复「用户先关注 OA（token 失败无 unionId 的占位行）后登录小程序」的场景
    if (!isMock && unionId && !user.oaOpenId) {
      try {
        // 查找 unionId 匹配的 OA 占位行
        const oaPlaceholder = await db.select({ id: usersTable.id, oaOpenId: usersTable.oaOpenId })
          .from(usersTable)
          .where(and(eq(usersTable.unionId, unionId), isNull(usersTable.openId)))
          .limit(1);

        if (oaPlaceholder.length > 0 && oaPlaceholder[0].oaOpenId) {
          // 将 oaOpenId 写入真实 MP 用户行，并删除占位行
          await db.update(usersTable)
            .set({ oaOpenId: oaPlaceholder[0].oaOpenId })
            .where(eq(usersTable.id, user.id));
          await db.delete(usersTable).where(eq(usersTable.id, oaPlaceholder[0].id));
          user.oaOpenId = oaPlaceholder[0].oaOpenId;
          req.log.info({ userId: user.id, oaOpenId: oaPlaceholder[0].oaOpenId, unionId },
            "MP login: oaOpenId linked from placeholder row");
        }
      } catch (linkErr) {
        req.log.warn({ linkErr }, "MP login: failed to link OA placeholder row");
      }
    }

    const token = user.sessionToken!;
    res.json({
      user:   { id: user.id, openId: user.openId, nickname: user.nickname, avatarUrl: user.avatarUrl, createdAt: user.createdAt },
      token,
      isMock,
      needsProfile: !user.avatarUrl || user.nickname === "微信用户" || user.nickname === "匿名用户",
    });
  } catch (err) {
    req.log.error({ err }, "WeChat login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/auth/mock-login ─────────────────────────────────────────────────
//
// Account matching priority:
//   1. Nickname provided → match by nickname (nickname = stable account key)
//      • If found: update sessionToken and re-bind deviceId so "quick login" follows
//      • If not found: create new user
//   2. No nickname → match by deviceId only (quick-login flow)
//
// This guarantees "same nickname → same account" even after the browser clears
// localStorage (which destroys the locally-stored deviceId, a common occurrence
// in WeChat's built-in WebView).
//
router.post("/mock-login", async (req, res) => {
  try {
    const body = MockLoginBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const deviceId = (req.body as Record<string, unknown>).deviceId as string | undefined;
    const nickname = body.data.nickname?.trim() ?? "";

    let user;

    if (nickname) {
      // ── Nickname-first path ──────────────────────────────────────────────────
      const existing = await db.select().from(usersTable)
        .where(eq(usersTable.nickname, nickname))
        .limit(1);

      if (existing.length > 0) {
        // Found by nickname. Keep existing token (avoid session invalidation on re-login).
        // If we also have a deviceId, re-bind it — but first release it from any
        // other user that currently holds it, to avoid a unique-constraint error.
        if (deviceId) {
          const newOpenId = `mock:${deviceId}`;
          if (existing[0].openId !== newOpenId) {
            await db.update(usersTable)
              .set({ openId: null })
              .where(eq(usersTable.openId, newOpenId));
          }
        }

        const keepToken = existing[0].sessionToken || generateToken();
        const updated = await db.update(usersTable)
          .set({
            sessionToken: keepToken,
            lastAccessAt: new Date(),
            ...(deviceId ? { openId: `mock:${deviceId}` } : {}),
          })
          .where(eq(usersTable.id, existing[0].id))
          .returning();
        user = updated[0];
      } else {
        // New nickname: create user.
        if (deviceId) {
          await db.update(usersTable)
            .set({ openId: null })
            .where(eq(usersTable.openId, `mock:${deviceId}`));
        }
        const inserted = await db.insert(usersTable).values({
          openId:       deviceId ? `mock:${deviceId}` : null,
          nickname,
          avatarUrl:    body.data.avatarUrl ?? null,
          sessionToken: generateToken(),
        }).returning();
        user = inserted[0];
      }
    } else if (deviceId) {
      // ── DeviceId-only path (quick login, no nickname) ────────────────────────
      const existing = await db.select().from(usersTable)
        .where(eq(usersTable.openId, `mock:${deviceId}`))
        .limit(1);

      if (existing.length > 0) {
        const keepToken = existing[0].sessionToken || generateToken();
        const updated = await db.update(usersTable)
          .set({ sessionToken: keepToken, lastAccessAt: new Date() })
          .where(eq(usersTable.openId, `mock:${deviceId}`))
          .returning();
        user = updated[0];
      } else {
        const inserted = await db.insert(usersTable).values({
          openId:       `mock:${deviceId}`,
          nickname:     "匿名用户",
          avatarUrl:    body.data.avatarUrl ?? null,
          sessionToken: generateToken(),
        }).returning();
        user = inserted[0];
      }
    } else {
      res.status(400).json({ error: "Either nickname or deviceId is required" });
      return;
    }

    res.json({
      user:  { id: user.id, openId: user.openId, nickname: user.nickname, avatarUrl: user.avatarUrl, createdAt: user.createdAt },
      token: user.sessionToken,
    });
  } catch (err) {
    req.log.error({ err }, "Mock login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post("/logout", async (req: AuthRequest, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      await db.update(usersTable)
        .set({ sessionToken: null })
        .where(eq(usersTable.sessionToken, token));
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Logout error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/auth/me ─────────────────────────────────────────────────────────
router.put("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { nickname, avatarUrl } = req.body as { nickname?: string; avatarUrl?: string };
    const updates: Record<string, unknown> = {};
    if (nickname?.trim()) updates.nickname = nickname.trim();
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl || null;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }

    const updated = await db.update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, req.userId!))
      .returning();

    const user = updated[0];
    res.json({ id: user.id, openId: user.openId, nickname: user.nickname, avatarUrl: user.avatarUrl });
  } catch (err) {
    req.log.error({ err }, "Update profile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/me", async (req: AuthRequest, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const token = authHeader.slice(7);
    const users = await db.select().from(usersTable).where(eq(usersTable.sessionToken, token)).limit(1);
    if (users.length === 0) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const user = users[0];
    // Update last access time (fire-and-forget)
    db.update(usersTable)
      .set({ lastAccessAt: new Date() })
      .where(eq(usersTable.id, user.id))
      .catch(() => {});
    res.json({ id: user.id, openId: user.openId, nickname: user.nickname, avatarUrl: user.avatarUrl, createdAt: user.createdAt });
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/auth/mp-subscribe-info ──────────────────────────────────────────
router.get("/mp-subscribe-info", requireAuth, async (req: AuthRequest, res) => {
  try {
    const templateId = await getSetting("mp_notify_template_id") ?? "vpfpK6EUtYVem_oGGaweNmz7C3uQ_9oaG9dbh2H81oQ";
    const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    const user = users[0];
    res.json({
      templateId,
      subscribed:     user?.mpSubscribed ?? false,
      subscribeCount: user?.mpSubscribeCount ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "mp-subscribe-info error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/auth/mp-subscribe ───────────────────────────────────────────────
router.post("/mp-subscribe", requireAuth, async (req: AuthRequest, res) => {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!users[0]) return res.status(404).json({ error: "User not found" });
    const newCount = (users[0].mpSubscribeCount ?? 0) + 1;
    await db.update(usersTable).set({
      mpSubscribed:     true,
      mpSubscribeCount: newCount,
    }).where(eq(usersTable.id, req.userId!));
    res.json({ success: true, subscribeCount: newCount });
  } catch (err) {
    req.log.error({ err }, "mp-subscribe error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── WeChat OA Webhook (server verification + event push) ──────────────────────
// Register URL: https://your-domain/api/auth/wechat/webhook
// Settings required: wechat_server_token (any string you set in WeChat OA backend)

// Helper: simple WeChat XML field extractor (handles both CDATA and plain text)
function wxXmlField(xml: string, tag: string): string {
  const m = xml.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?><!\\[CDATA\\[([^\\]]*)\\]\\]></${tag}>|<${tag}>([^<]*)</${tag}>`)
  );
  return m ? (m[1] ?? m[2] ?? "") : "";
}

// GET: WeChat server URL verification
router.get("/wechat/webhook", async (req, res) => {
  const { signature, timestamp, nonce, echostr } = req.query as Record<string, string>;
  const serverToken = (await getSetting("wechat_server_token")) || "";
  if (!serverToken) {
    res.status(400).send("wechat_server_token not configured");
    return;
  }
  const sorted = [serverToken, timestamp, nonce].sort().join("");
  const hash = crypto.createHash("sha1").update(sorted).digest("hex");
  if (hash === signature) {
    res.send(echostr);
  } else {
    res.status(403).send("Invalid signature");
  }
});

// POST: Handle WeChat OA event push (subscribe / unsubscribe)
router.post(
  "/wechat/webhook",
  express.text({ type: ["text/xml", "application/xml", "text/plain", "*/*"] }),
  async (req, res) => {
    // Always reply "success" immediately per WeChat spec
    res.send("success");

    const body = typeof req.body === "string" ? req.body : "";
    if (!body) return;

    const msgType  = wxXmlField(body, "MsgType");
    const event    = wxXmlField(body, "Event").toLowerCase();
    const fromUser = wxXmlField(body, "FromUserName");

    if (msgType !== "event" || !fromUser) return;

    req.log.info({ event, fromUser }, "WeChat OA event received");

    // 只处理关注事件（新关注 + 取消后再关注）
    if (event !== "subscribe") return;

    try {
      // ── Step 1: 无论 token 是否可用，先尝试通过 unionId 精确关联 ──────────────
      // token 失败（如 IP 白名单未配置）时，直接跳到 Step 2 保存占位行
      let oaUnionId: string | null = null;

      const oaToken = await getAccessToken();
      if (oaToken) {
        // 拉取 OA 用户信息，核心目的是拿到 unionId
        try {
          const infoUrl =
            `https://api.weixin.qq.com/cgi-bin/user/info` +
            `?access_token=${oaToken}&openid=${encodeURIComponent(fromUser)}&lang=zh_CN`;
          const infoResp = await fetch(infoUrl);
          const info = await infoResp.json() as { openid?: string; unionid?: string; errcode?: number };
          if (info.errcode) {
            req.log.warn({ errcode: info.errcode, fromUser }, "Webhook: failed to get OA user info");
          } else {
            oaUnionId = info.unionid || null;
          }
        } catch (err) {
          req.log.warn({ err }, "Webhook: error fetching OA user info");
        }
      } else {
        req.log.warn({ fromUser }, "Webhook: no OA access token (IP whitelist?), will save oaOpenId without unionId");
      }

      // ── Step 2: 优先通过 unionId 直接更新已有 MP 用户行 ──────────────────────
      if (oaUnionId) {
        const mpUser = await db.select({ id: usersTable.id })
          .from(usersTable)
          .where(and(eq(usersTable.unionId, oaUnionId), isNotNull(usersTable.openId)))
          .limit(1);

        if (mpUser.length > 0) {
          await db.update(usersTable)
            .set({ oaOpenId: fromUser })
            .where(eq(usersTable.id, mpUser[0].id));
          req.log.info({ userId: mpUser[0].id, oaOpenId: fromUser, unionId: oaUnionId },
            "Webhook: oaOpenId linked to MP user via unionId");
          return;
        }
      }

      // ── Step 3: 无法精确匹配时，写占位行（保存 oaOpenId，等 sync 或 MP 登录来关联）
      // 检查占位行是否已存在
      const byOa = await db.select({ id: usersTable.id, unionId: usersTable.unionId })
        .from(usersTable)
        .where(eq(usersTable.oaOpenId, fromUser))
        .limit(1);

      if (byOa.length === 0) {
        // 全新占位行：oaOpenId 已知，unionId 若有则一并写入
        await db.insert(usersTable).values({
          openId:   null as unknown as string,
          unionId:  oaUnionId || undefined,
          nickname: "微信用户",
          oaOpenId: fromUser,
        }).onConflictDoNothing();
        req.log.info({ oaOpenId: fromUser, unionId: oaUnionId }, "Webhook: OA-only placeholder row created");
      } else if (oaUnionId && !byOa[0].unionId) {
        // 占位行已存在但 unionId 还是空，现在补上
        await db.update(usersTable)
          .set({ unionId: oaUnionId })
          .where(eq(usersTable.oaOpenId, fromUser));
        req.log.info({ oaOpenId: fromUser, unionId: oaUnionId }, "Webhook: OA placeholder unionId updated");
      } else {
        req.log.info({ oaOpenId: fromUser }, "Webhook: OA placeholder already exists, no change needed");
      }
    } catch (err) {
      req.log.error({ err }, "Webhook: error processing subscribe event");
    }
  }
);

export default router;
