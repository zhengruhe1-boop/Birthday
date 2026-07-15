import type { announcementsTable } from "@workspace/db";
import { sanitizeAdminReply } from "./feedback-utils.js";

const VALID_APP_KEYS = new Set([
  "birthday_mp",
  "xishi_toolbox_mp",
  "xishi_toolbox_pc",
]);

export const APP_LABELS: Record<string, string> = {
  birthday_mp: "生日通小程序",
  xishi_toolbox_mp: "惜时工具箱小程序",
  xishi_toolbox_pc: "惜时工具箱PC端",
};

export function parseAppKeysJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => VALID_APP_KEYS.has(item));
  } catch {
    return [];
  }
}

export function normalizeAppKeys(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const key = item.trim();
    if (!VALID_APP_KEYS.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

export function serializeAppKeys(keys: string[]): string {
  return JSON.stringify(keys);
}

export function sanitizeAnnouncementContent(html: string): string {
  return sanitizeAdminReply(html);
}

export function stripHtmlPreview(html: string, maxLen = 80): string {
  const text = (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

export function formatAnnouncementRow(
  row: typeof announcementsTable.$inferSelect,
  opts?: { isUnread?: boolean },
) {
  const appKeys = parseAppKeysJson(row.appKeys);
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    appKeys,
    appLabels: appKeys.map((k) => APP_LABELS[k] || k),
    status: row.status,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    preview: stripHtmlPreview(row.content),
    isUnread: opts?.isUnread ?? false,
  };
}
