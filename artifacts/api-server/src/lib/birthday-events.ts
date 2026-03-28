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

  const prompt = `这是某人的出生日期：${dateLabel}。

请找出在${year}年${month}月${day}日当天或该日期前后几天内，中国和世界实际发生的3件重大历史事件或新闻，让人感受到"那一天世界正在发生什么"。

只返回一个JSON数组，格式：
[
  {"year":"${year}年","category":"中国","title":"事件标题","description":"事件简介"},
  {"year":"${year}年","category":"世界","title":"事件标题","description":"事件简介"},
  {"year":"${year}年","category":"中国","title":"事件标题","description":"事件简介"}
]

严格要求：
- year字段必须是${year}年或距${year}年极近的年份，绝对不能用与${year}相差超过5年的其他年份
- 所有事件必须是真实发生的历史事件
- 至少1条中国，至少1条世界
- title不超过15字，description不超过50字`;

  try {
    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: `你是历史学家，专门研究特定日期发生的真实历史事件。只返回JSON数组，不要任何其他文字。所有事件的year字段必须是${year}年或与${year}相差不超过2年的年份。`,
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "";
    logger.debug({ content: content.slice(0, 300) }, "DeepSeek birthday events raw response");

    const events = extractJsonArray(content);
    logger.info({ year, month, day, count: events.length }, "Birthday events generated via DeepSeek");
    return events.slice(0, 3);
  } catch (err) {
    logger.error({ err, year, month, day }, "Failed to generate birthday events via DeepSeek");
    return [];
  }
}
