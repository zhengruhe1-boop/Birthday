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

module.exports = { formatDate, formatDateTime, todayStr, calcAnniversaryYear, monthList, dayList, padTwo };
