import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: text("open_id").unique(),
  unionId: text("union_id"),
  nickname: text("nickname").notNull(),
  avatarUrl: text("avatar_url"),
  sessionToken: text("session_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastAccessAt: timestamp("last_access_at"),
  mpSubscribed: boolean("mp_subscribed").default(false).notNull(),
  mpSubscribeCount: integer("mp_subscribe_count").default(0).notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
