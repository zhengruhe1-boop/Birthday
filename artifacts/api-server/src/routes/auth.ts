import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { WechatLoginBody, MockLoginBody } from "@workspace/api-zod";
import { AuthRequest } from "../middlewares/auth.js";
import { getSetting } from "./admin.js";

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
    const loginMode    = await getSetting("login_mode") ?? "mock";
    const accountName  = await getSetting("wechat_account_name") ?? "";
    const notifyEnabled = (await getSetting("notify_enabled")) !== "false";
    const configured = !!(appId && secret && domain);
    res.json({
      configured,
      appId:         configured ? appId : null,
      loginMode,           // "wechat" | "mock"
      accountName,         // 公众号显示名称
      notifyEnabled,       // 是否开启消息通知
    });
  } catch {
    res.json({ configured: false, appId: null, loginMode: "mock", accountName: "", notifyEnabled: false });
  }
});

// ── GET /api/auth/wechat/oauth/callback ───────────────────────────────────────
// WeChat redirects here after user grants authorization
router.get("/wechat/oauth/callback", async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };

  const frontendBase = (await getSetting("wechat_callback_domain")) || "";

  if (!code) {
    return res.redirect(`${frontendBase}/?wechat_error=no_code`);
  }

  try {
    const appId     = await getSetting("wechat_appid");
    const appSecret = await getSetting("wechat_appsecret");

    if (!appId || !appSecret) {
      return res.redirect(`${frontendBase}/?wechat_error=not_configured`);
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
      return res.redirect(`${frontendBase}/?wechat_error=token_failed`);
    }

    // 2. Get user info
    const infoUrl =
      `https://api.weixin.qq.com/sns/userinfo` +
      `?access_token=${tokenData.access_token}&openid=${tokenData.openid}&lang=zh_CN`;

    const infoResp = await fetch(infoUrl);
    const infoData = await infoResp.json() as {
      openid?: string;
      nickname?: string;
      headimgurl?: string;
      errcode?: number;
    };

    if (infoData.errcode || !infoData.openid) {
      return res.redirect(`${frontendBase}/?wechat_error=userinfo_failed`);
    }

    const openId   = infoData.openid;
    const nickname = infoData.nickname || "微信用户";
    const avatar   = infoData.headimgurl || null;
    const token    = generateToken();

    // 3. Upsert user
    const existing = await db.select().from(usersTable)
      .where(eq(usersTable.openId, openId)).limit(1);

    if (existing.length > 0) {
      await db.update(usersTable)
        .set({ sessionToken: token, nickname, avatarUrl: avatar })
        .where(eq(usersTable.openId, openId));
    } else {
      await db.insert(usersTable).values({ openId, nickname, avatarUrl: avatar, sessionToken: token });
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
    return res.redirect(`${frontendBase}/?wechat_error=server_error`);
  }
});

// ── POST /api/auth/wechat/login (Mini Program jscode2session) ─────────────────
router.post("/wechat/login", async (req, res) => {
  try {
    const body = WechatLoginBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const appId = process.env.WECHAT_APPID;
    const appSecret = process.env.WECHAT_APP_SECRET;

    if (!appId || !appSecret) {
      res.status(500).json({ error: "WeChat not configured" });
      return;
    }

    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${body.data.code}&grant_type=authorization_code`;
    const response = await fetch(url);
    const data = await response.json() as { openid?: string; session_key?: string; errcode?: number; errmsg?: string };

    if (data.errcode || !data.openid) {
      req.log.error({ data }, "WeChat login failed");
      res.status(401).json({ error: data.errmsg || "WeChat login failed" });
      return;
    }

    const openId = data.openid;
    const token = generateToken();

    const existingUsers = await db.select().from(usersTable).where(eq(usersTable.openId, openId)).limit(1);

    let user;
    if (existingUsers.length > 0) {
      const updated = await db.update(usersTable)
        .set({ sessionToken: token })
        .where(eq(usersTable.openId, openId))
        .returning();
      user = updated[0];
    } else {
      const inserted = await db.insert(usersTable).values({
        openId,
        nickname: "微信用户",
        sessionToken: token,
      }).returning();
      user = inserted[0];
    }

    res.json({
      user: { id: user.id, openId: user.openId, nickname: user.nickname, avatarUrl: user.avatarUrl, createdAt: user.createdAt },
      token,
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

    const token    = generateToken();
    const deviceId = (req.body as Record<string, unknown>).deviceId as string | undefined;
    const nickname = body.data.nickname?.trim() ?? "";

    let user;

    if (nickname) {
      // ── Nickname-first path ──────────────────────────────────────────────────
      const existing = await db.select().from(usersTable)
        .where(eq(usersTable.nickname, nickname))
        .limit(1);

      if (existing.length > 0) {
        // Found by nickname.
        // If we also have a deviceId, re-bind it — but first release it from any
        // other user that currently holds it, to avoid a unique-constraint error.
        if (deviceId) {
          const newOpenId = `mock:${deviceId}`;
          if (existing[0].openId !== newOpenId) {
            // Clear the old holder (if any) of this deviceId
            await db.update(usersTable)
              .set({ openId: null })
              .where(eq(usersTable.openId, newOpenId));
          }
        }

        const updated = await db.update(usersTable)
          .set({
            sessionToken: token,
            ...(deviceId ? { openId: `mock:${deviceId}` } : {}),
          })
          .where(eq(usersTable.id, existing[0].id))
          .returning();
        user = updated[0];
      } else {
        // New nickname: create user.
        // Release the deviceId from any existing user first to avoid unique conflict.
        if (deviceId) {
          await db.update(usersTable)
            .set({ openId: null })
            .where(eq(usersTable.openId, `mock:${deviceId}`));
        }
        const inserted = await db.insert(usersTable).values({
          openId:       deviceId ? `mock:${deviceId}` : null,
          nickname,
          avatarUrl:    body.data.avatarUrl ?? null,
          sessionToken: token,
        }).returning();
        user = inserted[0];
      }
    } else if (deviceId) {
      // ── DeviceId-only path (quick login, no nickname) ────────────────────────
      const existing = await db.select().from(usersTable)
        .where(eq(usersTable.openId, `mock:${deviceId}`))
        .limit(1);

      if (existing.length > 0) {
        const updated = await db.update(usersTable)
          .set({ sessionToken: token })
          .where(eq(usersTable.openId, `mock:${deviceId}`))
          .returning();
        user = updated[0];
      } else {
        const inserted = await db.insert(usersTable).values({
          openId:       `mock:${deviceId}`,
          nickname:     "匿名用户",
          avatarUrl:    body.data.avatarUrl ?? null,
          sessionToken: token,
        }).returning();
        user = inserted[0];
      }
    } else {
      res.status(400).json({ error: "Either nickname or deviceId is required" });
      return;
    }

    res.json({
      user: { id: user.id, openId: user.openId, nickname: user.nickname, avatarUrl: user.avatarUrl, createdAt: user.createdAt },
      token,
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

export default router;
