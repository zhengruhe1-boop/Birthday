import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * Run lightweight CREATE TABLE IF NOT EXISTS migrations on startup.
 * Safe to run multiple times — only creates tables that do not yet exist.
 */
export async function runStartupMigrations(): Promise<void> {
  try {
    // events table (added after initial release — may be missing on older deployments)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "events" (
        "id"            serial        PRIMARY KEY,
        "user_id"       integer       NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type"          text          NOT NULL,
        "name"          text          NOT NULL,
        "event_date"    text,
        "person"        text,
        "reminder_time" text,
        "created_at"    timestamp     NOT NULL DEFAULT now()
      )
    `);
    logger.info("Startup migrations completed");
  } catch (err) {
    logger.error({ err }, "Startup migration failed — server will continue but some features may be broken");
  }
}
