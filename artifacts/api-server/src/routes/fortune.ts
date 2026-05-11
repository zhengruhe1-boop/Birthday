import { Router } from "express";
import OpenAI from "openai";
import { requireAuth, AuthRequest } from "../middlewares/auth.js";
import { getSetting } from "./admin.js";

const router = Router();

const SIGNS = [
  "白羊座","金牛座","双子座","巨蟹座","狮子座","处女座",
  "天秤座","天蝎座","射手座","摩羯座","水瓶座","双鱼座",
];

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { sign, date } = req.body as { sign?: string; date?: string };

  if (!sign || !SIGNS.includes(sign)) {
    return res.status(400).json({ error: "无效的星座" });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "无效的日期格式" });
  }

  // 优先用运势专属 key → 历史事件 key → 环境变量
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

  // 优先用运势专属模型 → 历史事件模型 → 默认
  const model =
    (await getSetting("fortune_model")) ||
    (await getSetting("ai_model")) ||
    "deepseek-chat";

  const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });

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
    return res.json({ ok: true, sign, date, fortune });
  } catch (err: any) {
    const msg = err?.message || "生成运势失败";
    return res.status(500).json({ error: msg });
  }
});

export default router;
