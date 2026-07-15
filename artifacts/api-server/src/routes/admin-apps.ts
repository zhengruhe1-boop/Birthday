import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { db, applicationsTable, appSettingsTable, userAppProfilesTable, analyticsEventsTable, settingsTable } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage.js";
import { LOCAL_UPLOAD_DIR } from "./upload.js";

const router = Router();

const CONFIG_KEYS = [
  "login.h5Mode",
  "login.mpMode",
  "wechat.oaAppId",
  "wechat.oaAppSecret",
  "wechat.oaDomain",
  "wechat.oaAccountName",
  "wechat.mpAppId",
  "wechat.mpAppSecret",
  "content.termsOfService",
  "content.privacyPolicy",
  "share.title",
  "share.description",
  "share.path",
  "share.imageUrl",
  "feature.enabled",
] as const;

const SENSITIVE_KEYS = new Set(["wechat.oaAppSecret", "wechat.mpAppSecret"]);

const LEGACY_SETTING_MAP: Record<string, string> = {
  "login.h5Mode": "login_mode",
  "login.mpMode": "login_mode_mp",
  "wechat.oaAppId": "wechat_appid",
  "wechat.oaAppSecret": "wechat_appsecret",
  "wechat.oaDomain": "wechat_callback_domain",
  "wechat.oaAccountName": "wechat_account_name",
  "wechat.mpAppId": "wechat_mp_appid",
  "wechat.mpAppSecret": "wechat_mp_appsecret",
  "content.termsOfService": "terms_of_service",
  "content.privacyPolicy": "privacy_policy",
  "share.title": "share_title",
  "share.description": "share_desc",
  "share.path": "share_path",
  "share.imageUrl": "share_img_url",
};

async function getLegacySetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

function useObjectStorage(): boolean {
  return !!process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
}

function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return objectStorageClient.bucket(bucketId);
}

function resolveMime(originalname: string, declaredMime: string): string {
  const ext = path.extname(originalname).toLowerCase();
  const extMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return extMap[ext] ?? (declaredMime.startsWith("image/") ? declaredMime : "image/jpeg");
}

const shareImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith("image/") || file.mimetype === "application/octet-stream";
    cb(ok ? null : new Error("只支持图片格式"), ok);
  },
});

function requireAdmin(req: Request, res: Response): boolean {
  const key = req.headers["x-admin-key"];
  const adminKey = process.env.ADMIN_KEY || "birthday-admin-2024";
  if (key !== adminKey) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

async function getApp(appKey: string) {
  const rows = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.appKey, appKey))
    .limit(1);
  return rows[0] ?? null;
}

function maskSensitiveValue(key: string, value: string, settings: Record<string, string>) {
  if (SENSITIVE_KEYS.has(key) && value) {
    settings[key] = "••••••" + value.slice(-4);
    settings[key + "Set"] = "true";
    return;
  }
  settings[key] = value;
}

async function readSettings(appKey: string): Promise<Record<string, string>> {
  const rows = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.appKey, appKey));
  const settings: Record<string, string> = {};
  for (const row of rows) {
    maskSensitiveValue(row.key, row.value, settings);
  }

  if (appKey === "birthday_mp") {
    for (const [settingKey, legacyKey] of Object.entries(LEGACY_SETTING_MAP)) {
      if (settings[settingKey]) continue;
      const legacy = await getLegacySetting(legacyKey);
      if (!legacy) continue;
      if (settingKey === "login.h5Mode" && legacy === "wechat") {
        maskSensitiveValue(settingKey, "wechat_oa", settings);
      } else {
        maskSensitiveValue(settingKey, legacy, settings);
      }
    }
  }

  return settings;
}

async function setAppSetting(appKey: string, key: string, value: string): Promise<void> {
  const existing = await db
    .select()
    .from(appSettingsTable)
    .where(and(eq(appSettingsTable.appKey, appKey), eq(appSettingsTable.key, key)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(appSettingsTable)
      .set({ value, updatedAt: new Date() })
      .where(and(eq(appSettingsTable.appKey, appKey), eq(appSettingsTable.key, key)));
    return;
  }

  await db.insert(appSettingsTable).values({ appKey, key, value });
}

router.get("/", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const apps = await db
      .select()
      .from(applicationsTable)
      .orderBy(applicationsTable.sortOrder, applicationsTable.id);

    const profiles = await db.select().from(userAppProfilesTable);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentEvents = await db
      .select()
      .from(analyticsEventsTable)
      .where(gte(analyticsEventsTable.createdAt, thirtyDaysAgo))
      .orderBy(desc(analyticsEventsTable.createdAt));

    const result = await Promise.all(
      apps.map(async (app) => {
        const settings = await readSettings(app.appKey);
        return {
          ...app,
          userCount: profiles.filter((profile) => profile.appKey === app.appKey).length,
          activeUsers30d: new Set(
            recentEvents
              .filter((event) => event.appKey === app.appKey && event.userId)
              .map((event) => event.userId),
          ).size,
          launchCount30d: recentEvents.filter(
            (event) => event.appKey === app.appKey && event.eventType === "app_launch",
          ).length,
          settings,
        };
      }),
    );

    res.json({ apps: result });
  } catch (err) {
    req.log.error({ err }, "Failed to list applications");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/:appKey/upload-share-image",
  (req: Request, res: Response, next) => {
    if (!requireAdmin(req, res)) return;
    next();
  },
  shareImageUpload.single("image"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "请上传图片" });
      return;
    }

    try {
      const appKey = String(req.params.appKey);
      const app = await getApp(appKey);
      if (!app) {
        res.status(404).json({ error: "Application not found" });
        return;
      }

      const file = req.file as Express.Multer.File & { buffer: Buffer };
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      const filename = `share_${crypto.randomBytes(12).toString("hex")}${ext}`;

      if (useObjectStorage()) {
        const objectPath = `uploads/${filename}`;
        const contentType = resolveMime(file.originalname, file.mimetype);
        const bucket = getBucket();
        await bucket.file(objectPath).save(file.buffer, { contentType, resumable: false });
      } else {
        if (!fs.existsSync(LOCAL_UPLOAD_DIR)) fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
        fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, filename), file.buffer);
      }

      const url = `/api/uploads/${filename}`;
      await setAppSetting(appKey, "share.imageUrl", url);
      res.json({ url });
    } catch (err) {
      req.log.error({ err }, "Failed to upload share image");
      res.status(500).json({ error: "上传失败" });
    }
  },
);

router.get("/:appKey/config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const appKey = String(req.params.appKey);
    const app = await getApp(appKey);
    if (!app) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    res.json({ app, settings: await readSettings(app.appKey), configurableKeys: CONFIG_KEYS });
  } catch (err) {
    req.log.error({ err }, "Failed to read application config");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:appKey/config", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const appKey = String(req.params.appKey);
    const app = await getApp(appKey);
    if (!app) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    const body = req.body as {
      name?: string;
      domain?: string;
      description?: string;
      enabled?: boolean;
      settings?: Record<string, string | boolean | number | null>;
    };

    const appUpdates: Partial<typeof applicationsTable.$inferInsert> = {};
    if (body.name !== undefined) appUpdates.name = String(body.name).trim();
    if (body.domain !== undefined) appUpdates.domain = String(body.domain).trim();
    if (body.description !== undefined) appUpdates.description = String(body.description).trim();
    if (body.enabled !== undefined) appUpdates.enabled = !!body.enabled;

    if (Object.keys(appUpdates).length > 0) {
      await db
        .update(applicationsTable)
        .set({ ...appUpdates, updatedAt: new Date() })
        .where(eq(applicationsTable.appKey, app.appKey));
    }

    if (body.settings && typeof body.settings === "object") {
      for (const [key, rawValue] of Object.entries(body.settings)) {
        if (!CONFIG_KEYS.includes(key as (typeof CONFIG_KEYS)[number])) continue;
        const strVal = rawValue == null ? "" : String(rawValue);
        if (SENSITIVE_KEYS.has(key) && strVal.startsWith("••••••")) continue;
        await setAppSetting(app.appKey, key, strVal);
      }
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update application config");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
