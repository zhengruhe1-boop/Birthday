import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
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
  // 用户邮箱（选填，用于邮件提醒）
  reminderEmail: text("reminder_email"),
  // 提前几天提醒（逗号分隔，如 "0,1,3"）；null 表示使用管理后台全局设置
  reminderDaysBefore: text("reminder_days_before"),
  // 每天发送小时（0-23）；null 表示使用管理后台全局设置
  reminderSendHour: integer("reminder_send_hour"),
  // 是否在列表中隐藏（不影响通知）
  hidden: boolean("hidden").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Event = typeof eventsTable.$inferSelect;
