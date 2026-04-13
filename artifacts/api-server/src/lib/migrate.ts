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

    logger.info("Startup migrations completed");
  } catch (err) {
    logger.error({ err }, "Startup migration failed — server will continue but some features may be broken");
  }
}
