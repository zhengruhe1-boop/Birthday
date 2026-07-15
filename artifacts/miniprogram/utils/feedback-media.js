function getBase() {
  try {
    const app = getApp();
    return ((app && app.globalData && app.globalData.apiBase) || "").replace(/\/$/, "");
  } catch {
    return "";
  }
}

function toAbsUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const base = getBase();
  return base + (url.startsWith("/") ? url : `/${url}`);
}

function prepareReplyHtml(html) {
  if (!html) return "";
  const base = getBase();
  let result = html;
  result = result.replace(/src="(\/api\/uploads\/[^"]+)"/g, `src="${base}$1"`);
  result = result.replace(
    /<img\b([^>]*)>/gi,
    (_match, attrs) => {
      const cleaned = attrs.replace(/\s*style="[^"]*"/gi, "");
      return `<img${cleaned} style="max-width:100%;width:100%;height:auto;display:block;margin:12rpx 0;border-radius:12rpx;" />`;
    },
  );
  return result;
}

function stripHtmlToPreview(html, maxLen = 80) {
  if (!html) return "";
  let text = html
    .replace(/<img[^>]*>/gi, " [图片] ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > maxLen) {
    return `${text.slice(0, maxLen)}…`;
  }
  return text;
}

function hasHtmlContent(html) {
  return /<[^>]+>/.test(html || "");
}

function mapImageUrls(images) {
  return (images || []).map((url) => toAbsUrl(url)).filter(Boolean);
}

module.exports = {
  toAbsUrl,
  prepareReplyHtml,
  mapImageUrls,
  stripHtmlToPreview,
  hasHtmlContent,
};
