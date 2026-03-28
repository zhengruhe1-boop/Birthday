import OpenAI from "openai";
import { logger } from "./logger.js";

const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export interface BirthdayEvent {
  year: string;
  category: "中国" | "世界";
  title: string;
  description: string;
}

function extractJsonArray(text: string): BirthdayEvent[] {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // continue
  }

  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // continue
    }
  }

  logger.warn({ raw: text.slice(0, 200) }, "Could not parse birthday events JSON");
  return [];
}

export async function generateBirthdayEvents(
  year: number,
  month: number,
  day: number,
  isLunar: boolean
): Promise<BirthdayEvent[]> {
  const calType = isLunar ? "农历" : "公历";
  const dateLabel = `${calType}${year}年${month}月${day}日`;

  const prompt = `出生日期：${dateLabel}

任务：找出历史上在 ${year}年${month}月（即这个月份前后2周内）真实发生的3件重大历史事件。

硬性规定（违反则答案无效）：
1. year字段只能填"${year}年"，禁止填写任何其他年份
2. 事件日期必须在 ${year}年${month}月 前后2周范围内（${month-1 > 0 ? month-1 : 12}月中旬 ~ ${month+1 <= 12 ? month+1 : 1}月初）
3. 必须是真实发生的历史事件，不能编造
4. 至少1条中国事件，至少1条世界事件
5. title不超过15字，description不超过50字

只返回JSON数组，不加任何说明：
[
  {"year":"${year}年","category":"中国","title":"事件标题","description":"事件简介，含具体月日"},
  {"year":"${year}年","category":"世界","title":"事件标题","description":"事件简介，含具体月日"},
  {"year":"${year}年","category":"中国","title":"事件标题","description":"事件简介，含具体月日"}
]`;

  try {
    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 700,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `你是严谨的历史学家。只返回JSON数组，绝不返回其他内容。
规则：所有事件year字段必须且只能是"${year}年"，事件必须发生在${year}年${month}月附近。`,
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "";
    logger.debug({ content: content.slice(0, 400) }, "DeepSeek birthday events raw response");

    const events = extractJsonArray(content);

    // Filter out any events with wrong years
    const filtered = events.filter(e => e.year && e.year.includes(String(year)));
    logger.info({ year, month, day, count: filtered.length, raw: events.length }, "Birthday events generated via DeepSeek");

    return filtered.slice(0, 3);
  } catch (err) {
    logger.error({ err, year, month, day }, "Failed to generate birthday events via DeepSeek");
    return [];
  }
}
