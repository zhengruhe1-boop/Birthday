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
  enabled:        boolean;
  provider:       string;
  model:          string;
  apiKeySet:      boolean;
  temperature:    number;
  filterKeywords: string[];
}

export async function getAiConfig(): Promise<AiConfig> {
  const [enabled, provider, model, customKey, temperature, filterKw] = await Promise.all([
    getSettingLocal("ai_enabled"),
    getSettingLocal("ai_provider"),
    getSettingLocal("ai_model"),
    getSettingLocal("ai_api_key_custom"),
    getSettingLocal("ai_temperature"),
    getSettingLocal("ai_filter_keywords"),
  ]);

  const apiKeySet = !!(customKey || process.env.DEEPSEEK_API_KEY);

  // 若 DB 尚未配置过滤词，返回内置默认列表
  const filterKeywords: string[] = filterKw !== null
    ? filterKw.split(",").map(s => s.trim()).filter(Boolean)
    : DEFAULT_FILTER_KEYWORDS;

  return {
    enabled:     enabled !== "false",
    provider:    provider    ?? "deepseek",
    model:       model       ?? "deepseek-chat",
    apiKeySet,
    temperature: parseFloat(temperature ?? "0.3") || 0.3,
    filterKeywords,
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

// ── 内置默认过滤关键词（管理员未自定义时使用）────────────────────────────────
export const DEFAULT_FILTER_KEYWORDS = [
  "枪击", "刺杀", "暗杀", "遇刺", "行刺",
  "死亡", "去世", "逝世", "殉难", "殉职", "牺牲", "阵亡", "遇难",
  "自杀", "被杀", "被害", "被刺", "被暗杀",
  "战争", "战役", "战斗", "交战", "炮击", "轰炸", "屠杀", "屠城", "大屠杀",
  "沉没", "坠毁", "撞机", "空难", "坠落", "失事",
  "灭亡", "覆灭", "亡国", "灭国",
  "处决", "行刑", "绞刑", "斩首",
  "地震", "海啸", "洪水", "灾难", "瘟疫", "鼠疫",
  "爆炸", "恐怖",
];

function isNegativeEvent(event: BirthdayEvent, keywords: string[]): boolean {
  const text = `${event.title} ${event.description}`;
  return keywords.some(kw => kw && text.includes(kw));
}

// ── Main generator: historical events on a specific month/day ─────────────────
export async function generateBirthdayEvents(
  month: number,
  day:   number,
): Promise<BirthdayEvent[]> {
  const [ai, cfg] = await Promise.all([buildAiClient(), getAiConfig()]);
  if (!ai) {
    logger.warn("AI not configured or disabled, skipping birthday events generation");
    return [];
  }

  const filterKeywords = cfg.filterKeywords.length > 0 ? cfg.filterKeywords : DEFAULT_FILTER_KEYWORDS;
  const kwStr = filterKeywords.join("、");
  const dateLabel = `${month}月${day}日`;

  const prompt = `历史上的${dateLabel}：请从古代到现代中，找出不同年代真实发生在${month}月${day}日（允许±1天）的5件重大历史事件。

要求：
1. 事件必须真实，不能编造
2. 年代尽量跨度大（包含古代、近代、现代）
3. 至少2件中国历史事件，至少2件世界历史事件
4. year字段填写具体年份（如"1949年"），title不超过20字，description不超过60字（须含具体月日）
5. 【严格禁止】绝对不能包含任何涉及以下内容的事件：${kwStr}
   - 只选取积极、振奋人心或中性的历史事件，例如：科技发明、建国立邦、条约签订、重大发现、重要会议、体育竞赛、文化艺术成就、经济建设等

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
          content: `你是严谨的历史学家。只返回JSON数组，绝不返回任何其他内容。所有事件必须是真实存在的历史事实。【严禁】出现以下任何关键词：${kwStr}。只选择积极、建设性或中性的历史大事。`,
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "";
    logger.debug({ content: content.slice(0, 400) }, "AI birthday events raw response");

    const rawEvents = extractJsonArray(content);

    // 后端关键词过滤（使用动态关键词列表）
    const filtered = rawEvents.filter(e => !isNegativeEvent(e, filterKeywords));
    const removed  = rawEvents.length - filtered.length;
    if (removed > 0) {
      logger.warn({ month, day, removed }, "Filtered out negative birthday events");
    }

    logger.info({ month, day, count: filtered.length }, "Birthday events generated via AI");
    return filtered.slice(0, 5);
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
