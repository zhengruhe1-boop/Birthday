import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { getSetting } from "./admin.js";
import { generateAndCacheFortune } from "../lib/fortune-scheduler.js";

const router = Router();

const SIGNS = [
  "白羊座","金牛座","双子座","巨蟹座","狮子座","处女座",
  "天秤座","天蝎座","射手座","摩羯座","水瓶座","双鱼座",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getFromServerCache(sign: string, date: string): Promise<object | null> {
  try {
    const rows = await db.execute(sql`
      SELECT data FROM fortune_cache WHERE sign = ${sign} AND date = ${date} LIMIT 1
    `);
    if ((rows.rows as any[]).length > 0) {
      const data = (rows.rows[0] as any).data;
      return typeof data === "string" ? JSON.parse(data) : data;
    }
  } catch { /* ignore */ }
  return null;
}

// ── GET /api/fortune/:sign/:date — public cache check ─────────────────────────
router.get("/:sign/:date", async (req: Request, res: Response) => {
  const { sign, date } = req.params;
  if (!sign || !SIGNS.includes(decodeURIComponent(sign))) {
    return res.status(400).json({ error: "无效的星座" });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "无效的日期格式" });
  }

  const decodedSign = decodeURIComponent(sign);
  const fortune = await getFromServerCache(decodedSign, date);
  if (fortune) {
    return res.json({ ok: true, sign: decodedSign, date, fortune, fromCache: true });
  }
  return res.status(404).json({ ok: false, message: "未找到缓存运势" });
});

// ── POST /api/fortune — generate (with cache + user sign tracking) ─────────────
router.post("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const { sign, date } = req.body as { sign?: string; date?: string };

  if (!sign || !SIGNS.includes(sign)) {
    return res.status(400).json({ error: "无效的星座" });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "无效的日期格式" });
  }

  // 1. Check server cache first
  const cached = await getFromServerCache(sign, date);
  if (cached) {
    // Also update user's fortune_sign if needed (fire-and-forget)
    void db.execute(sql`
      UPDATE users SET fortune_sign = ${sign} WHERE id = ${req.userId!}
    `).catch(() => {});
    return res.json({ ok: true, sign, date, fortune: cached, fromCache: true });
  }

  // 2. Get API key and model
  const apiKey =
    (await getSetting("fortune_api_key")) ||
    (await getSetting("ai_api_key_custom")) ||
    process.env.DEEPSEEK_API_KEY ||
    "";

  if (!apiKey) {
    return res
      .status(503)
      .json({ error: "运势服务暂未配置 API Key，请在管理后台「AI 模型 → 今日运势」中填写" });
  }

  const model =
    (await getSetting("fortune_model")) ||
    (await getSetting("ai_model")) ||
    "deepseek-chat";

  // 3. Generate via DeepSeek
  const prompt = `你是一位专业的星座运势分析师。请为以下用户生成今日运势，严格以 JSON 格式返回，不要任何额外内容。

用户星座：${sign}
查询日期：${date}

返回如下 JSON 格式（score 取 0-100 整数）：
{
  "summary": "今日总运概述（60-100字，有具体指引）",
  "love": { "score": 85, "desc": "爱情运势描述（25-40字）" },
  "career": { "score": 72, "desc": "事业运势描述（25-40字）" },
  "wealth": { "score": 68, "desc": "财运运势描述（25-40字）" },
  "health": { "score": 90, "desc": "健康运势描述（25-40字）" },
  "outfit": "今日穿搭推荐（40-60字，含颜色、风格、单品建议）",
  "tip": "今日小贴士（20-30字）"
}`;

  try {
    const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("无法解析运势数据");

    const fortune = JSON.parse(jsonMatch[0]);

    // 4. Save to server cache + update user's saved sign (parallel, fire-and-forget errors)
    void Promise.all([
      db.execute(sql`
        INSERT INTO fortune_cache (sign, date, data)
        VALUES (${sign}, ${date}, ${JSON.stringify(fortune)})
        ON CONFLICT (sign, date) DO UPDATE SET data = ${JSON.stringify(fortune)}, created_at = now()
      `),
      db.execute(sql`
        UPDATE users SET fortune_sign = ${sign} WHERE id = ${req.userId!}
      `),
    ]).catch(() => {});

    return res.json({ ok: true, sign, date, fortune });
  } catch (err: any) {
    const msg = err?.message || "生成运势失败";
    return res.status(500).json({ error: msg });
  }
});

export default router;
