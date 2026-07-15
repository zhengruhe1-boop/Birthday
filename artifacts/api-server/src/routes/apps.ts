import { Router, type Request, type Response } from "express";
import { db, applicationsTable, appSettingsTable, settingsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router = Router();

async function getLegacySetting(key: string): Promise<string | null> {
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

async function getAppSetting(appKey: string, key: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(appSettingsTable)
    .where(and(eq(appSettingsTable.appKey, appKey), eq(appSettingsTable.key, key)))
    .limit(1);
  return rows[0]?.value ?? null;
}

async function getConfigValue(appKey: string, appKeySetting: string, legacyKey?: string): Promise<string> {
  const appValue = await getAppSetting(appKey, appKeySetting);
  if (appValue !== null) return appValue;
  if (legacyKey) return (await getLegacySetting(legacyKey)) ?? "";
  return "";
}

router.get("/:appKey/public-config", async (req: Request, res: Response) => {
  try {
    const appKey = String(req.params.appKey);
    const apps = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.appKey, appKey))
      .limit(1);
    const app = apps[0];

    if (!app) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    const termsOfService = await getConfigValue(appKey, "content.termsOfService", "terms_of_service");
    const privacyPolicy = await getConfigValue(appKey, "content.privacyPolicy", "privacy_policy");
    const h5LoginMode = await getConfigValue(appKey, "login.h5Mode", "login_mode");
    const mpLoginMode = await getConfigValue(appKey, "login.mpMode", "login_mode_mp");
    const shareTitle = await getConfigValue(appKey, "share.title", "share_title");
    const shareDescription = await getConfigValue(appKey, "share.description", "share_desc");
    const sharePath = await getConfigValue(appKey, "share.path", "share_path");
    const shareImageUrl = await getConfigValue(appKey, "share.imageUrl", "share_img_url");

    res.json({
      app: {
        appKey: app.appKey,
        name: app.name,
        appType: app.appType,
        domain: app.domain,
        enabled: app.enabled,
      },
      login: {
        h5Mode: h5LoginMode || "mock",
        mpMode: mpLoginMode || "mock",
      },
      content: {
        termsOfService,
        privacyPolicy,
      },
      share: {
        title: shareTitle,
        description: shareDescription,
        path: sharePath,
        imageUrl: shareImageUrl,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to read public application config");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
