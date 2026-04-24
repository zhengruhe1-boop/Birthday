export interface ZodiacSign {
  name: string;
  symbol: string;
}

/** 星座名称 → Unicode 符号 映射表 */
export const ZODIAC_SYMBOLS: Record<string, string> = {
  摩羯座: "♑",
  水瓶座: "♒",
  双鱼座: "♓",
  白羊座: "♈",
  金牛座: "♉",
  双子座: "♊",
  巨蟹座: "♋",
  狮子座: "♌",
  处女座: "♍",
  天秤座: "♎",
  天蝎座: "♏",
  射手座: "♐",
};

/**
 * Returns the Western zodiac (星座) for a given solar month and day.
 * Returns null for invalid inputs.
 * @deprecated Prefer server-returned `contact.zodiac` which supports lunar conversion.
 */
export function getZodiacSign(month: number, day: number): ZodiacSign | null {
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const md = month * 100 + day;

  if (md >= 1222 || md <= 119) return { name: "摩羯座", symbol: "♑" };
  if (md <= 218) return { name: "水瓶座", symbol: "♒" };
  if (md <= 320) return { name: "双鱼座", symbol: "♓" };
  if (md <= 419) return { name: "白羊座", symbol: "♈" };
  if (md <= 520) return { name: "金牛座", symbol: "♉" };
  if (md <= 621) return { name: "双子座", symbol: "♊" };
  if (md <= 722) return { name: "巨蟹座", symbol: "♋" };
  if (md <= 822) return { name: "狮子座", symbol: "♌" };
  if (md <= 922) return { name: "处女座", symbol: "♍" };
  if (md <= 1023) return { name: "天秤座", symbol: "♎" };
  if (md <= 1122) return { name: "天蝎座", symbol: "♏" };
  if (md <= 1221) return { name: "射手座", symbol: "♐" };

  return null;
}
