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
    const monthStr = month + "月";
    const dayStr = day + "日";
    return monthStr + dayStr;
  }
}

export function calcDaysUntilBirthday(month: number, day: number): number {
  const today = new Date();
  const currentYear = today.getFullYear();
  
  let nextBirthday = new Date(currentYear, month - 1, day);
  
  today.setHours(0, 0, 0, 0);
  nextBirthday.setHours(0, 0, 0, 0);
  
  if (nextBirthday < today) {
    nextBirthday = new Date(currentYear + 1, month - 1, day);
  }
  
  const diffTime = nextBirthday.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
