/**
 * 日期工具函数
 */

function padTwo(n) {
  return String(n).padStart(2, '0');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.getFullYear() + '-' + padTwo(d.getMonth() + 1) + '-' + padTwo(d.getDate());
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.getFullYear() + '-' + padTwo(d.getMonth() + 1) + '-' + padTwo(d.getDate())
    + ' ' + padTwo(d.getHours()) + ':' + padTwo(d.getMinutes());
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + padTwo(d.getMonth() + 1) + '-' + padTwo(d.getDate());
}

function calcAnniversaryYear(eventDate) {
  if (!eventDate) return 0;
  const today = new Date();
  const origin = new Date(eventDate + 'T00:00:00');
  const thisYear = new Date(today.getFullYear(), origin.getMonth(), origin.getDate());
  const targetYear = thisYear < today ? today.getFullYear() + 1 : today.getFullYear();
  return targetYear - origin.getFullYear();
}

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const DAYS_RANGE = Array.from({ length: 31 }, (_, i) => String(i + 1) + '日');

function monthList() { return MONTHS; }
function dayList() { return DAYS_RANGE; }

const ZODIAC_SIGNS = [
  { name: '摩羯座', m: 1,  d: 20 }, { name: '水瓶座', m: 2,  d: 19 },
  { name: '双鱼座', m: 3,  d: 20 }, { name: '白羊座', m: 4,  d: 20 },
  { name: '金牛座', m: 5,  d: 21 }, { name: '双子座', m: 6,  d: 21 },
  { name: '巨蟹座', m: 7,  d: 23 }, { name: '狮子座', m: 8,  d: 23 },
  { name: '处女座', m: 9,  d: 23 }, { name: '天秤座', m: 10, d: 23 },
  { name: '天蝎座', m: 11, d: 22 }, { name: '射手座', m: 12, d: 22 },
  { name: '摩羯座', m: 1,  d: 31 },
];

function getZodiac(month, day) {
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (!m || !d) return '';
  for (var i = 0; i < ZODIAC_SIGNS.length; i++) {
    var s = ZODIAC_SIGNS[i];
    if (m < s.m || (m === s.m && d < s.d)) return s.name;
  }
  return '摩羯座';
}

module.exports = { formatDate, formatDateTime, todayStr, calcAnniversaryYear, monthList, dayList, padTwo, getZodiac };
