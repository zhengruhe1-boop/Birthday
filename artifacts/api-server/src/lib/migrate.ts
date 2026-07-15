import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

const DEFAULT_APPLICATIONS = [
  {
    appKey: "birthday_mp",
    name: "生日通小程序",
    appType: "mini_program",
    domain: "https://shengritong.kuixi.com",
    description: "现有生日通微信小程序",
    sortOrder: 10,
  },
  {
    appKey: "xishi_toolbox_mp",
    name: "惜时工具箱小程序",
    appType: "mini_program",
    domain: "https://tool.xishi24.com",
    description: "待开发的惜时工具箱微信小程序",
    sortOrder: 20,
  },
  {
    appKey: "xishi_toolbox_pc",
    name: "惜时工具箱PC端",
    appType: "pc_web",
    domain: "https://tool.xishi24.com",
    description: "惜时工具箱 PC Web 端",
    sortOrder: 30,
  },
];

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
    await db.execute(sql`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "registered_app_key" text NOT NULL DEFAULT 'birthday_mp'
    `);
    await db.execute(sql`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "registered_client_type" text NOT NULL DEFAULT 'mini_program'
    `);

    // Multi-application control plane. This is additive and keeps birthday_mp
    // as the default so existing Birthday app behavior is unchanged.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "applications" (
        "id"          serial    PRIMARY KEY,
        "app_key"     text      NOT NULL UNIQUE,
        "name"        text      NOT NULL,
        "app_type"    text      NOT NULL,
        "domain"      text,
        "description" text,
        "enabled"     boolean   NOT NULL DEFAULT true,
        "sort_order"  integer   NOT NULL DEFAULT 0,
        "created_at"  timestamp NOT NULL DEFAULT now(),
        "updated_at"  timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "app_settings" (
        "id"          serial    PRIMARY KEY,
        "app_key"     text      NOT NULL,
        "key"         text      NOT NULL,
        "value"       text      NOT NULL,
        "updated_at"  timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "app_settings_app_key_key_idx"
      ON "app_settings" ("app_key", "key")
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "user_app_profiles" (
        "id"             serial    PRIMARY KEY,
        "user_id"        integer   NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "app_key"        text      NOT NULL,
        "client_type"    text      NOT NULL,
        "login_method"   text,
        "registered_at"  timestamp NOT NULL DEFAULT now(),
        "last_access_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_app_profiles_user_app_idx"
      ON "user_app_profiles" ("user_id", "app_key")
    `);
    for (const app of DEFAULT_APPLICATIONS) {
      await db.execute(sql`
        INSERT INTO "applications" ("app_key", "name", "app_type", "domain", "description", "sort_order")
        VALUES (${app.appKey}, ${app.name}, ${app.appType}, ${app.domain}, ${app.description}, ${app.sortOrder})
        ON CONFLICT ("app_key") DO UPDATE SET
          "name" = EXCLUDED."name",
          "app_type" = EXCLUDED."app_type",
          "domain" = EXCLUDED."domain",
          "description" = EXCLUDED."description",
          "sort_order" = EXCLUDED."sort_order",
          "updated_at" = now()
      `);
    }

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
    // Multi-app tool ownership + category grouping
    await db.execute(sql`ALTER TABLE "mp_tools" ADD COLUMN IF NOT EXISTS "app_key" text NOT NULL DEFAULT 'birthday_mp'`);
    await db.execute(sql`ALTER TABLE "mp_tools" ADD COLUMN IF NOT EXISTS "category_id" integer`);

    // 5b. mp_tool_categories table — tool grouping per app
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "mp_tool_categories" (
        "id"          serial    PRIMARY KEY,
        "app_key"     text      NOT NULL DEFAULT 'birthday_mp',
        "name"        text      NOT NULL,
        "icon"        text      NOT NULL DEFAULT '📁',
        "sort_order"  integer   NOT NULL DEFAULT 0,
        "created_at"  timestamp NOT NULL DEFAULT now()
      )
    `);

    // 5c. mp_tool_app_bindings — many-to-many: tool ↔ frontend apps
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "mp_tool_app_bindings" (
        "id"            serial    PRIMARY KEY,
        "tool_id"       integer,
        "builtin_name"  text,
        "app_key"       text      NOT NULL,
        "path"          text      NOT NULL DEFAULT '',
        "category_id"   integer,
        "enabled"       boolean   NOT NULL DEFAULT true,
        "created_at"    timestamp NOT NULL DEFAULT now(),
        UNIQUE("tool_id", "app_key"),
        UNIQUE("builtin_name", "app_key")
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

    // 7. time_capsules table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "time_capsules" (
        "id"              serial    PRIMARY KEY,
        "user_id"         integer   NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "message"         text      NOT NULL,
        "photo_urls"      text,
        "open_at"         text      NOT NULL,
        "reminder_email"  text,
        "notify_enabled"  boolean   NOT NULL DEFAULT true,
        "opened"          boolean   NOT NULL DEFAULT false,
        "created_at"      timestamp NOT NULL DEFAULT now()
      )
    `);

    // Add title column to time_capsules (existing deployments)
    await db.execute(sql`
      ALTER TABLE "time_capsules" ADD COLUMN IF NOT EXISTS "title" text
    `);

    // Per-contact / per-event reminder customization
    await db.execute(sql`
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "reminder_days_before" text
    `);
    await db.execute(sql`
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "reminder_send_hour" integer
    `);
    await db.execute(sql`
      ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "reminder_days_before" text
    `);
    await db.execute(sql`
      ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "reminder_send_hour" integer
    `);

    // 8. analytics_events table — lightweight event tracking
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "analytics_events" (
        "id"          serial    PRIMARY KEY,
        "user_id"     integer,
        "app_key"     text      NOT NULL DEFAULT 'birthday_mp',
        "event_type"  text      NOT NULL,
        "page"        text,
        "created_at"  timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "app_key" text NOT NULL DEFAULT 'birthday_mp'
    `);

    // 9. feedback table — user feedback & admin replies
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "feedback" (
        "id"            serial    PRIMARY KEY,
        "user_id"       integer   NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "app_key"       text      NOT NULL DEFAULT 'birthday_mp',
        "content"       text      NOT NULL,
        "contact"       text,
        "status"        text      NOT NULL DEFAULT 'pending',
        "admin_reply"   text,
        "user_read_at"  timestamp,
        "replied_at"    timestamp,
        "created_at"    timestamp NOT NULL DEFAULT now(),
        "updated_at"    timestamp NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`
      ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "images" text
    `);

    // 10. announcements — admin-published internal messages per app(s)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "announcements" (
        "id"            serial    PRIMARY KEY,
        "title"         text      NOT NULL,
        "content"       text      NOT NULL,
        "app_keys"      text      NOT NULL DEFAULT '[]',
        "status"        text      NOT NULL DEFAULT 'published',
        "published_at"  timestamp,
        "created_at"    timestamp NOT NULL DEFAULT now(),
        "updated_at"    timestamp NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "announcement_reads" (
        "id"               serial    PRIMARY KEY,
        "announcement_id"  integer   NOT NULL REFERENCES "announcements"("id") ON DELETE CASCADE,
        "user_id"          integer   NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "app_key"          text      NOT NULL,
        "read_at"          timestamp NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "announcement_reads_uniq"
      ON "announcement_reads" ("announcement_id", "user_id", "app_key")
    `);

    logger.info("Startup migrations completed");
  } catch (err) {
    logger.error({ err }, "Startup migration failed — server will continue but some features may be broken");
  }
}
