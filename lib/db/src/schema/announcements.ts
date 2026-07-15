import { pgTable, serial, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users.js";

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  /** JSON string array of app keys, e.g. ["birthday_mp","xishi_toolbox_mp"] */
  appKeys: text("app_keys").notNull().default("[]"),
  status: text("status").notNull().default("published"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const announcementReadsTable = pgTable(
  "announcement_reads",
  {
    id: serial("id").primaryKey(),
    announcementId: integer("announcement_id")
      .notNull()
      .references(() => announcementsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    appKey: text("app_key").notNull(),
    readAt: timestamp("read_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("announcement_reads_uniq").on(
      table.announcementId,
      table.userId,
      table.appKey,
    ),
  ],
);

export type Announcement = typeof announcementsTable.$inferSelect;
export type InsertAnnouncement = typeof announcementsTable.$inferInsert;
export type AnnouncementRead = typeof announcementReadsTable.$inferSelect;
