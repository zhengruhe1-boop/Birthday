import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Run lightweight CREATE TABLE IF NOT EXISTS migrations on startup.
 * Safe to run multiple times — only creates tables that do not yet exist.
 */
export async function runStartupMigrations(): Promise<void> {
  try {
    // 1. users table (must be created first — other tables reference it)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id"                   serial    PRIMARY KEY,
        "open_id"              text      UNIQUE,
        "nickname"             text      NOT NULL,
        "avatar_url"           text,
        "session_token"        text,
        "created_at"           timestamp NOT NULL DEFAULT now(),
        "last_access_at"       timestamp,
        "mp_subscribed"        boolean   NOT NULL DEFAULT false,
        "mp_subscribe_count"   integer   NOT NULL DEFAULT 0
      )
    `);

    // Add columns that may be missing on older deployments
    await db.execute(sql`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mp_subscribed" boolean NOT NULL DEFAULT false
    `);
    await db.execute(sql`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mp_subscribe_count" integer NOT NULL DEFAULT 0
    `);
    await db.execute(sql`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "union_id" text
    `);

    // 2. contacts table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "contacts" (
        "id"               serial    PRIMARY KEY,
        "user_id"          integer   NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name"             text      NOT NULL,
        "gender"           text,
        "birthday_month"   integer   NOT NULL,
        "birthday_day"     integer   NOT NULL,
        "birthday_lunar"   boolean   NOT NULL DEFAULT false,
        "birth_year"       integer,
        "relation"         text,
        "hometown"         text,
        "reminder_email"   text,
        "avatar_url"       text,
        "birthday_events"  text,
        "created_at"       timestamp NOT NULL DEFAULT now()
      )
    `);

    // 3. settings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "settings" (
        "id"          serial    PRIMARY KEY,
        "key"         text      NOT NULL UNIQUE,
        "value"       text      NOT NULL,
        "updated_at"  timestamp NOT NULL DEFAULT now()
      )
    `);

    // 4. events table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "events" (
        "id"              serial    PRIMARY KEY,
        "user_id"         integer   NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type"            text      NOT NULL,
        "name"            text      NOT NULL,
        "event_date"      text,
        "person"          text,
        "reminder_time"   text,
        "reminder_email"  text,
        "created_at"      timestamp NOT NULL DEFAULT now()
      )
    `);

    // Add reminder_email column to existing deployments that may not have it
    await db.execute(sql`
      ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "reminder_email" text
    `);
    // Add hidden column (list visibility toggle, does not affect notifications)
    await db.execute(sql`
      ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT false
    `);

    // oa_open_id: 公众号 OpenID，由 OA 事件 webhook 写入，用于发送 OA 模板消息
    await db.execute(sql`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "oa_open_id" text
    `);
    // hidden: 联系人隐藏开关（不在首页列表显示，不影响通知）
    await db.execute(sql`
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT false
    `);
    // extra_quota: 用户通过分享/看广告/跳转等操作额外获得的添加次数
    await db.execute(sql`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "extra_quota" integer NOT NULL DEFAULT 0
    `);

    // 5. mp_tools table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "mp_tools" (
        "id"          serial    PRIMARY KEY,
        "name"        text      NOT NULL,
        "description" text      NOT NULL DEFAULT '',
        "icon"        text      NOT NULL DEFAULT '🔧',
        "type"        text      NOT NULL DEFAULT 'internal',
        "path"        text      NOT NULL DEFAULT '',
        "app_id"      text      NOT NULL DEFAULT '',
        "page_path"   text      NOT NULL DEFAULT '',
        "sort_order"  integer   NOT NULL DEFAULT 0,
        "enabled"     boolean   NOT NULL DEFAULT true,
        "created_at"  timestamp NOT NULL DEFAULT now()
      )
    `);

    // 6. fortune_cache table — server-side cache keyed by (sign, date)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "fortune_cache" (
        "id"          serial    PRIMARY KEY,
        "sign"        text      NOT NULL,
        "date"        text      NOT NULL,
        "data"        jsonb     NOT NULL,
        "created_at"  timestamp NOT NULL DEFAULT now(),
        UNIQUE("sign", "date")
      )
    `);

    // fortune_sign: user's last selected zodiac sign for auto pre-generation
    await db.execute(sql`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fortune_sign" text
    `);

    logger.info("Startup migrations completed");
  } catch (err) {
    logger.error({ err }, "Startup migration failed — server will continue but some features may be broken");
  }
}
