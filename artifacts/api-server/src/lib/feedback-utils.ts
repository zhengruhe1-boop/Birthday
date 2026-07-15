import type { feedbackTable } from "@workspace/db";

const MAX_IMAGES = 3;
const MAX_REPLY_LENGTH = 20000;

export function parseImagesJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => isValidUploadUrl(item))
      .slice(0, MAX_IMAGES);
  } catch {
    return [];
  }
}

export function isValidUploadUrl(url: string): boolean {
  return /^\/api\/uploads\/[a-zA-Z0-9._-]+$/.test(url);
}

export function normalizeImageUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => isValidUploadUrl(item))
    .slice(0, MAX_IMAGES);
}

export function serializeImages(urls: string[]): string | null {
  if (!urls.length) return null;
  return JSON.stringify(urls);
}

export function sanitizeAdminReply(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";

  return trimmed
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .slice(0, MAX_REPLY_LENGTH);
}

export function formatFeedbackRow(row: typeof feedbackTable.$inferSelect) {
  const images = parseImagesJson(row.images);
  const adminReply = row.adminReply || "";
  return {
    id: row.id,
    appKey: row.appKey,
    content: row.content,
    contact: row.contact,
    images,
    status: row.status,
    adminReply: adminReply || null,
    hasReply: !!adminReply.trim(),
    isUnread: !!adminReply.trim() && !row.userReadAt,
    userReadAt: row.userReadAt,
    repliedAt: row.repliedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
