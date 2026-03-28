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
  const dateLabel = isLunar
    ? `农历${year}年${month}月${day}日`
    : `公历${year}年${month}月${day}日`;

  const prompt = `请列举在${dateLabel}这一天（即${month}月${day}日，不限年份）发生的3件有意义的重大历史事件，包含中国和世界的事件。同时，可以特别提及${year}年前后这个时代的重要历史背景。

只返回一个JSON数组，格式：
[
  {"year":"1949年","category":"中国","title":"中华人民共和国成立","description":"毛泽东在天安门城楼宣告中华人民共和国成立，开启了新中国历史。"},
  {"year":"1969年","category":"世界","title":"阿波罗11号登月","description":"美国宇航员阿姆斯特朗成为踏上月球表面的第一人。"},
  {"year":"1978年","category":"中国","title":"改革开放启动","description":"中国开启改革开放新时代，经济社会发展进入历史新纪元。"}
]

要求：至少1条中国，至少1条世界，选真实事件，title不超过15字，description不超过50字。`;

  try {
    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: "你是历史学家。只返回JSON数组，不要任何其他文字。",
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
