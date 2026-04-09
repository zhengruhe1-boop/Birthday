import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  // 'anniversary' | 'countdown' | 'other'
  type: text("type").notNull(),
  // 共用字段
  name: text("name").notNull(),
  // 纪念日 & 倒数日 用到（ISO date "YYYY-MM-DD"）
  eventDate: text("event_date"),
  // 纪念日 人物
  person: text("person"),
  // 其它 提醒时间（"YYYY-MM-DD HH:mm"）
  reminderTime: text("reminder_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Event = typeof eventsTable.$inferSelect;
