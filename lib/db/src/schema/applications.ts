import { pgTable, serial, text, timestamp, boolean, integer, uniqueIndex } from "drizzle-orm/pg-core";

export const applicationsTable = pgTable("applications", {
  id: serial("id").primaryKey(),
  appKey: text("app_key").notNull().unique(),
  name: text("name").notNull(),
  appType: text("app_type").notNull(),
  domain: text("domain"),
  description: text("description"),
  enabled: boolean("enabled").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const appSettingsTable = pgTable(
  "app_settings",
  {
    id: serial("id").primaryKey(),
    appKey: text("app_key").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    appKeyKeyIdx: uniqueIndex("app_settings_app_key_key_idx").on(table.appKey, table.key),
  }),
);

export const userAppProfilesTable = pgTable(
  "user_app_profiles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    appKey: text("app_key").notNull(),
    clientType: text("client_type").notNull(),
    loginMethod: text("login_method"),
    registeredAt: timestamp("registered_at").defaultNow().notNull(),
    lastAccessAt: timestamp("last_access_at").defaultNow().notNull(),
  },
  (table) => ({
    userAppIdx: uniqueIndex("user_app_profiles_user_app_idx").on(table.userId, table.appKey),
  }),
);

export type Application = typeof applicationsTable.$inferSelect;
export type AppSetting = typeof appSettingsTable.$inferSelect;
export type UserAppProfile = typeof userAppProfilesTable.$inferSelect;
