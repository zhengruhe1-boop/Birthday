/**
 * 微信公众号服务器端事件接口
 *
 * GET  /api/wechat/oa  — 微信服务器 URL 验证（配置时调用一次）
 * POST /api/wechat/oa  — 接收微信推送事件（关注/取消关注等）
 *
 * 配置步骤：
 *   微信公众平台 → 设置与开发 → 基本配置 → 服务器配置
 *   URL:   https://shengritong.kuixi.com/api/wechat/oa
 *   Token: 与管理后台"服务器 Token"字段保持一致
 */
import express, { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { getSetting } from "./admin.js";

const router: IRouter = Router();

// XML 解析（轻量手写，不依赖额外包）
function parseXmlField(xml: string, field: string): string {
  const m = xml.match(new RegExp(`<${field}><!\\[CDATA\\[([^\\]]*?)\\]\\]></${field}>|<${field}>([^<]*?)</${field}>`));
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

// ── 签名验证 ──────────────────────────────────────────────────────────────────
function verifySignature(token: string, timestamp: string, nonce: string, signature: string): boolean {
  const sorted = [token, timestamp, nonce].sort().join("");
  const hash   = crypto.createHash("sha1").update(sorted).digest("hex");
  return hash === signature;
}

// ── GET：URL 接入验证 ─────────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  const { signature, timestamp, nonce, echostr } = req.query as Record<string, string>;
  const token = await getSetting("wechat_server_token");

  if (!token) {
    logger.warn("OA webhook: wechat_server_token not configured");
    res.status(403).send("token not configured");
    return;
  }
  if (!signature || !timestamp || !nonce || !echostr) {
    res.status(400).send("missing params");
    return;
  }
  if (verifySignature(token, timestamp, nonce, signature)) {
    res.send(echostr);
  } else {
    res.status(403).send("signature mismatch");
  }
});

// ── POST：事件接收（使用 express.text 解析 XML body）─────────────────────────
router.post(
  "/",
  express.text({ type: ["text/xml", "application/xml", "*/*"], limit: "64kb" }),
  async (req: Request, res: Response) => {
    // 先收齐 body 再立即回复，防止微信超时重发
    const rawXml = typeof req.body === "string" ? req.body : "";

    // 立即返回成功，微信要求 5 秒内响应
    res.set("Content-Type", "application/xml")
      .send("<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>");

    if (!rawXml) return;

    try {
      // 可选：验证签名
      const token = await getSetting("wechat_server_token");
      if (token) {
        const { signature, timestamp, nonce } = req.query as Record<string, string>;
        if (signature && !verifySignature(token, timestamp ?? "", nonce ?? "", signature)) {
          logger.warn("OA webhook POST: signature mismatch, ignoring");
          return;
        }
      }

      const msgType    = parseXmlField(rawXml, "MsgType").toLowerCase();
      const event      = parseXmlField(rawXml, "Event").toLowerCase();
      const fromOpenId = parseXmlField(rawXml, "FromUserName");
      const unionId    = parseXmlField(rawXml, "UnionId") || null;

      logger.info({ msgType, event, fromOpenId, hasUnionId: !!unionId }, "OA webhook event received");

      // 只处理关注事件（subscribe / scan 二维码也触发）
      if (msgType !== "event" || !["subscribe", "scan"].includes(event)) return;
      if (!fromOpenId) return;

      // ── 尝试通过 UnionId 关联已有 MP 用户 ──────────────────────────────────
      if (unionId) {
        const mpUsers = await db.select().from(usersTable)
          .where(and(eq(usersTable.unionId, unionId), isNotNull(usersTable.openId)))
          .limit(1);

        if (mpUsers.length > 0) {
          await db.update(usersTable)
            .set({ oaOpenId: fromOpenId })
            .where(eq(usersTable.id, mpUsers[0].id));
          logger.info({ userId: mpUsers[0].id, oaOpenId: fromOpenId, unionId },
            "OA openId linked to MP user via unionId");
          return;
        }
      }

      // ── 无 UnionId 可匹配时：插入或更新 OA 专属行 ─────────────────────────
      const existing = await db.select().from(usersTable)
        .where(eq(usersTable.oaOpenId, fromOpenId)).limit(1);

      if (existing.length === 0) {
        await db.insert(usersTable).values({
          openId:   null as unknown as string,
          unionId:  unionId ?? undefined,
          nickname: "微信用户",
          oaOpenId: fromOpenId,
        }).onConflictDoNothing();
        logger.info({ oaOpenId: fromOpenId }, "OA-only user row created");
      } else if (unionId && !existing[0].unionId) {
        await db.update(usersTable)
          .set({ unionId })
          .where(eq(usersTable.oaOpenId, fromOpenId));
      }
    } catch (err) {
      logger.error({ err }, "OA webhook POST handler error");
    }
  },
);

export default router;
