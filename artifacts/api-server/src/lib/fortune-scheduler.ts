import OpenAI from "openai";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { getSetting } from "../routes/admin.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return today's date string in Beijing time (UTC+8): "YYYY-MM-DD" */
function todayBeijing(): string {
  const now = new Date();
  const bjOffset = 8 * 60; // minutes
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const bjDate = new Date(utcMs + bjOffset * 60000);
  const y = bjDate.getFullYear();
  const m = String(bjDate.getMonth() + 1).padStart(2, "0");
  const d = String(bjDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Milliseconds until next midnight in Beijing time (00:00 CST) */
function msUntilMidnightBeijing(): number {
  const now = new Date();
  const bjOffset = 8 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const bjNow = new Date(utcMs + bjOffset * 60000);

  const nextMidnight = new Date(bjNow);
  nextMidnight.setHours(24, 0, 0, 0); // next midnight in Beijing

  return nextMidnight.getTime() - bjNow.getTime();
}

/** Build DeepSeek prompt for a sign+date */
function buildPrompt(sign: string, date: string): string {
  return `你是一位专业的星座运势分析师。请为以下用户生成今日运势，严格以 JSON 格式返回，不要任何额外内容。

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
}

/** Generate fortune for one sign+date and upsert into fortune_cache. Returns true on success. */
export async function generateAndCacheFortune(sign: string, date: string): Promise<boolean> {
  try {
    const apiKey =
      (await getSetting("fortune_api_key")) ||
      (await getSetting("ai_api_key_custom")) ||
      process.env.DEEPSEEK_API_KEY ||
      "";

    if (!apiKey) {
      logger.warn({ sign, date }, "Fortune scheduler: no API key configured, skipping");
      return false;
    }

    const model =
      (await getSetting("fortune_model")) ||
      (await getSetting("ai_model")) ||
      "deepseek-chat";

    const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });

    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: buildPrompt(sign, date) }],
      temperature: 0.8,
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn({ sign, date, raw: raw.slice(0, 200) }, "Fortune scheduler: could not parse JSON");
      return false;
    }

    const fortune = JSON.parse(jsonMatch[0]);

    // Upsert into fortune_cache
    await db.execute(sql`
      INSERT INTO fortune_cache (sign, date, data)
      VALUES (${sign}, ${date}, ${JSON.stringify(fortune)})
      ON CONFLICT (sign, date) DO UPDATE SET data = ${JSON.stringify(fortune)}, created_at = now()
    `);

    logger.info({ sign, date }, "Fortune scheduler: cached fortune");
    return true;
  } catch (err) {
    logger.error({ err, sign, date }, "Fortune scheduler: error generating fortune");
    return false;
  }
}

/** Run the daily midnight job: pre-generate fortunes for all users who have a saved sign */
async function runDailyFortuneJob(): Promise<void> {
  const date = todayBeijing();
  logger.info({ date }, "Fortune scheduler: starting daily job");

  try {
    // Get all distinct fortune_sign values from users
    const rows = await db.execute(sql`
      SELECT DISTINCT fortune_sign FROM users
      WHERE fortune_sign IS NOT NULL AND fortune_sign != ''
    `);

    const signs = (rows.rows as { fortune_sign: string }[])
      .map((r) => r.fortune_sign)
      .filter(Boolean);

    logger.info({ date, count: signs.length }, "Fortune scheduler: signs to pre-generate");

    for (const sign of signs) {
      // Check if already cached for today
      const cached = await db.execute(sql`
        SELECT id FROM fortune_cache WHERE sign = ${sign} AND date = ${date} LIMIT 1
      `);
      if ((cached.rows as any[]).length > 0) {
        logger.info({ sign, date }, "Fortune scheduler: already cached, skipping");
        continue;
      }

      await generateAndCacheFortune(sign, date);

      // Small delay between calls to avoid rate limiting
      await new Promise((r) => setTimeout(r, 1500));
    }

    logger.info({ date }, "Fortune scheduler: daily job complete");
  } catch (err) {
    logger.error({ err, date }, "Fortune scheduler: daily job error");
  }
}

/** Start the fortune scheduler — runs at midnight Beijing time every day */
export function scheduleFortunePreGeneration(): void {
  const ms = msUntilMidnightBeijing();
  const hours = (ms / 3600000).toFixed(2);
  logger.info({ nextRunInHours: hours }, "Fortune scheduler: first run scheduled");

  setTimeout(() => {
    void runDailyFortuneJob();
    // Then repeat every 24 hours
    setInterval(() => void runDailyFortuneJob(), 24 * 60 * 60 * 1000);
  }, ms);
}
