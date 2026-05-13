// @ts-ignore — lunar-javascript 没有官方 TS 类型声明
import { Lunar, Solar } from "lunar-javascript";

const CHINESE_ZODIAC = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const HEAVENLY_STEMS   = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 根据出生年（公历）返回生肖，例如 1990 → '马' */
export function getChineseZodiac(year: number): string {
  if (!year) return '';
  return CHINESE_ZODIAC[((year - 2020) % 12 + 1200) % 12];
}

/** 根据出生年（公历）返回天干地支年名，例如 1990 → '庚午' */
export function getGanZhi(year: number): string {
  if (!year) return '';
  const stem   = HEAVENLY_STEMS[((year - 4) % 10 + 1000) % 10];
  const branch = EARTHLY_BRANCHES[((year - 4) % 12 + 1200) % 12];
  return stem + branch;
}

const LUNAR_MONTHS = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
const LUNAR_DAYS_1_10 = ["初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十"];
const LUNAR_DAYS_11_20 = ["十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十"];
const LUNAR_DAYS_21_30 = ["廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];

export function formatBirthdayDisplay(month: number, day: number, lunar: boolean): string {
  if (lunar) {
    const monthStr = LUNAR_MONTHS[month - 1] + "月";
    let dayStr = "";
    if (day <= 10) {
      dayStr = LUNAR_DAYS_1_10[day - 1];
    } else if (day <= 20) {
      dayStr = LUNAR_DAYS_11_20[day - 11];
    } else {
      dayStr = LUNAR_DAYS_21_30[day - 21];
    }
    return monthStr + dayStr;
  } else {
    return month + "月" + day + "日";
  }
}

/**
 * 将农历月日转换为指定公历年份对应的公历日期。
 * 如果该年该农历月日不存在（如闰月缺失），则向后顺延到下一个有效日期。
 * 返回 Date 对象（本地时间 00:00:00）。
 */
function lunarToSolarDate(lunarYear: number, lunarMonth: number, lunarDay: number): Date | null {
  try {
    const lunar = Lunar.fromYmd(lunarYear, lunarMonth, lunarDay);
    const solar: { getYear(): number; getMonth(): number; getDay(): number } = lunar.getSolar();
    return new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
  } catch {
    return null;
  }
}

/**
 * 获取星座名称（支持公历和农历）。
 * 农历生日先用当年公历转换，再匹配星座范围；公历生日直接匹配。
 */
export function getZodiacName(month: number, day: number, lunar: boolean): string {
  let m = month;
  let d = day;

  if (lunar) {
    // 用当前公历年做参考年尝试农历→公历转换
    const refYear = new Date().getFullYear();
    for (const tryYear of [refYear, refYear - 1, refYear + 1]) {
      const solar = lunarToSolarDate(tryYear, month, day);
      if (solar) {
        m = solar.getMonth() + 1;
        d = solar.getDate();
        break;
      }
    }
  }

  if (!m || !d || m < 1 || m > 12 || d < 1 || d > 31) return "";

  const md = m * 100 + d;
  if (md >= 1222 || md <= 119) return "摩羯座";
  if (md <= 218) return "水瓶座";
  if (md <= 320) return "双鱼座";
  if (md <= 419) return "白羊座";
  if (md <= 520) return "金牛座";
  if (md <= 621) return "双子座";
  if (md <= 722) return "巨蟹座";
  if (md <= 822) return "狮子座";
  if (md <= 922) return "处女座";
  if (md <= 1023) return "天秤座";
  if (md <= 1122) return "天蝎座";
  if (md <= 1221) return "射手座";
  return "";
}

/**
 * 计算距离下一个生日的天数。
 * - 公历生日：直接按公历月日计算
 * - 农历生日：先将农历月日转换为今年/明年的公历日期，再计算差值
 */
export function calcDaysUntilBirthday(
  month: number,
  day: number,
  birthYear?: number,
  lunar = false,
): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!lunar) {
    // ── 公历生日 ──────────────────────────────────────────────────────────────
    const currentYear = today.getFullYear();
    let next = new Date(currentYear, month - 1, day);
    next.setHours(0, 0, 0, 0);
    if (next < today) {
      next = new Date(currentYear + 1, month - 1, day);
      next.setHours(0, 0, 0, 0);
    }
    return Math.ceil((next.getTime() - today.getTime()) / 86400000);
  }

  // ── 农历生日：尝试今年，若已过则用明年 ─────────────────────────────────────
  const currentYear = today.getFullYear();

  // 农历年号大约比公历年号小 1（春节前后），保险起见尝试当前公历年 ±1
  for (const tryLunarYear of [currentYear - 1, currentYear, currentYear + 1]) {
    const solarDate = lunarToSolarDate(tryLunarYear, month, day);
    if (!solarDate) continue;
    solarDate.setHours(0, 0, 0, 0);
    if (solarDate >= today) {
      return Math.ceil((solarDate.getTime() - today.getTime()) / 86400000);
    }
  }

  // 兜底：若三年内都找不到有效日期（极端情况），按公历计算
  const fallback = new Date(currentYear, month - 1, day);
  fallback.setHours(0, 0, 0, 0);
  if (fallback < today) fallback.setFullYear(currentYear + 1);
  return Math.ceil((fallback.getTime() - today.getTime()) / 86400000);
}
