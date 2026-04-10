import { Router, type IRouter } from "express";
import { createHash } from "crypto";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAccessToken } from "../lib/wechat-notify.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ── In-memory jsapi_ticket cache ──────────────────────────────────────────────
let ticketCache: { ticket: string; expiresAt: number } | null = null;

async function getJsapiTicket(): Promise<string | null> {
  if (ticketCache && ticketCache.expiresAt > Date.now() + 60_000) {
    return ticketCache.ticket;
  }
  const token = await getAccessToken();
  if (!token) return null;

  const url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${token}&type=jsapi`;
  try {
    const resp = await fetch(url);
    const data = await resp.json() as {
      ticket?: string;
      expires_in?: number;
      errcode?: number;
      errmsg?: string;
    };
    if (data.errcode || !data.ticket) {
      logger.error({ errcode: data.errcode, errmsg: data.errmsg }, "Failed to get jsapi_ticket");
      return null;
    }
    ticketCache = {
      ticket:    data.ticket,
      expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    };
    return ticketCache.ticket;
  } catch (err) {
    logger.error({ err }, "Network error fetching jsapi_ticket");
    return null;
  }
}

async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

// ── GET /api/share/jssdk-config?url=CURRENT_PAGE_URL ─────────────────────────
// Public endpoint — returns WeChat JS-SDK config + share content for the page.
// The `url` param must equal the exact URL visible in the browser address bar
// (no hash fragment), as WeChat uses it for signature verification.
router.get("/jssdk-config", async (req, res) => {
  try {
    const pageUrl = (req.query.url as string | undefined)?.trim();
    if (!pageUrl) {
      res.status(400).json({ error: "url query parameter is required" });
      return;
    }

    const appId = await getSetting("wechat_appid");
    if (!appId) {
      res.status(503).json({ error: "WeChat not configured" });
      return;
    }

    const ticket = await getJsapiTicket();
    if (!ticket) {
      res.status(503).json({ error: "Could not obtain jsapi_ticket" });
      return;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const nonceStr  = Math.random().toString(36).slice(2, 18);

    // Signature: sha1 of lexicographically sorted key=value pairs joined by "&"
    const signStr =
      `jsapi_ticket=${ticket}` +
      `&noncestr=${nonceStr}` +
      `&timestamp=${timestamp}` +
      `&url=${pageUrl}`;
    const signature = createHash("sha1").update(signStr).digest("hex");

    // Share content (fall back to sensible defaults if not configured)
    const shareTitle  = (await getSetting("share_title"))   || "生日通 - 不再错过重要生日";
    const shareDesc   = (await getSetting("share_desc"))    || "智能生日提醒，农历公历都支持";
    const shareImgUrl = (await getSetting("share_img_url")) || "";
    const shareLink   = (await getSetting("share_link"))    || pageUrl;

    res.json({ appId, timestamp, nonceStr, signature, shareTitle, shareDesc, shareImgUrl, shareLink });
  } catch (err) {
    logger.error({ err }, "jssdk-config error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
