import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { WechatLoginBody, MockLoginBody } from "@workspace/api-zod";
import { AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

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
      user: {
        id: user.id,
        openId: user.openId,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err) {
    req.log.error({ err }, "WeChat login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/mock-login", async (req, res) => {
  try {
    const body = MockLoginBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const token = generateToken();
    const inserted = await db.insert(usersTable).values({
      nickname: body.data.nickname,
      avatarUrl: body.data.avatarUrl ?? null,
      sessionToken: token,
    }).returning();
    const user = inserted[0];

    res.json({
      user: {
        id: user.id,
        openId: user.openId,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (err) {
    req.log.error({ err }, "Mock login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

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
    res.json({
      id: user.id,
      openId: user.openId,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Get me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
