import OpenAI from "openai";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

// ── Local settings helper (avoids circular import with admin.ts) ──────────────
async function getSettingLocal(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export interface BirthdayEvent {
  year:        string;
  category:    "中国" | "世界";
  title:       string;
  description: string;
}

function extractJsonArray(text: string): BirthdayEvent[] {
  let cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }

  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
  }

  logger.warn({ raw: text.slice(0, 200) }, "Could not parse birthday events JSON");
  return [];
}

// ── AI client factory (reads config from DB, falls back to env var) ───────────
export interface AiConfig {
  enabled:     boolean;
  provider:    string;
  model:       string;
  apiKeySet:   boolean;
  temperature: number;
}

export async function getAiConfig(): Promise<AiConfig> {
  const [enabled, provider, model, customKey, temperature] = await Promise.all([
    getSettingLocal("ai_enabled"),
    getSettingLocal("ai_provider"),
    getSettingLocal("ai_model"),
    getSettingLocal("ai_api_key_custom"),
    getSettingLocal("ai_temperature"),
  ]);

  const apiKeySet = !!(customKey || process.env.DEEPSEEK_API_KEY);
  return {
    enabled:     enabled !== "false",
    provider:    provider    ?? "deepseek",
    model:       model       ?? "deepseek-chat",
    apiKeySet,
    temperature: parseFloat(temperature ?? "0.3") || 0.3,
  };
}

async function buildAiClient(): Promise<{ client: OpenAI; model: string; temperature: number } | null> {
  const cfg = await getAiConfig();
  if (!cfg.enabled) return null;

  const customKey = await getSettingLocal("ai_api_key_custom");
  const apiKey    = customKey || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  // Extensible: add more providers here as needed
  const baseURLMap: Record<string, string> = {
    deepseek: "https://api.deepseek.com",
  };
  const baseURL = baseURLMap[cfg.provider] ?? "https://api.deepseek.com";

  return {
    client:      new OpenAI({ baseURL, apiKey }),
    model:       cfg.model,
    temperature: cfg.temperature,
  };
}

// ── Main generator: historical events on a specific month/day ─────────────────
export async function generateBirthdayEvents(
  month: number,
  day:   number,
): Promise<BirthdayEvent[]> {
  const ai = await buildAiClient();
  if (!ai) {
    logger.warn("AI not configured or disabled, skipping birthday events generation");
    return [];
  }

  const dateLabel = `${month}月${day}日`;

  const prompt = `历史上的${dateLabel}：请从古代到现代中，找出不同年代真实发生在${month}月${day}日（允许±1天）的5件重大历史事件。

要求：
1. 事件必须真实，不能编造
2. 年代尽量跨度大（包含古代、近代、现代）
3. 至少2件中国历史事件，至少2件世界历史事件
4. year字段填写具体年份（如"1949年"），title不超过20字，description不超过60字（须含具体月日）
5. 【重要】禁止包含任何人物逝世、去世、死亡、遇刺、殉难等负面内容；只选取积极、建设性或中性的历史事件（如：发明、建国、条约签订、重大发现、战争胜利、重要会议等）

只返回JSON数组，不加任何说明：
[
  {"year":"XXXX年","category":"中国","title":"事件标题","description":"具体描述含月日"},
  {"year":"XXXX年","category":"世界","title":"事件标题","description":"具体描述含月日"}
]`;

  try {
    const response = await ai.client.chat.completions.create({
      model:       ai.model,
      max_tokens:  900,
      temperature: ai.temperature,
      messages: [
        {
          role:    "system",
          content: "你是严谨的历史学家。只返回JSON数组，绝不返回任何其他内容。所有事件必须是真实存在的历史事实。严禁出现任何人物逝世、去世、死亡、遇刺、殉难等负面死亡内容。",
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "";
    logger.debug({ content: content.slice(0, 400) }, "AI birthday events raw response");

    const events = extractJsonArray(content);
    logger.info({ month, day, count: events.length }, "Birthday events generated via AI");
    return events.slice(0, 5);
  } catch (err) {
    logger.error({ err, month, day }, "Failed to generate birthday events via AI");
    return [];
  }
}

// ── Quick connectivity test ────────────────────────────────────────────────────
export async function testAiConnection(): Promise<{ ok: boolean; model: string; message: string }> {
  const ai = await buildAiClient();
  if (!ai) {
    const cfg = await getAiConfig();
    if (!cfg.enabled)  return { ok: false, model: cfg.model, message: "AI 功能已关闭" };
    return { ok: false, model: cfg.model, message: "API Key 未配置" };
  }

  try {
    const res = await ai.client.chat.completions.create({
      model:       ai.model,
      max_tokens:  10,
      temperature: 0,
      messages: [{ role: "user", content: "reply: ok" }],
    });
    const reply = res.choices[0]?.message?.content ?? "(空)";
    return { ok: true, model: ai.model, message: `连接成功，模型响应：${reply.slice(0, 40)}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, model: ai.model, message: `连接失败：${msg.slice(0, 80)}` };
  }
}
