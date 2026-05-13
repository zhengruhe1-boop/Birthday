import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const timeCapsulesTable = pgTable("time_capsules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  photoUrls: text("photo_urls"),
  openAt: text("open_at").notNull(),
  reminderEmail: text("reminder_email"),
  notifyEnabled: boolean("notify_enabled").default(true).notNull(),
  opened: boolean("opened").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TimeCapsule = typeof timeCapsulesTable.$inferSelect;
