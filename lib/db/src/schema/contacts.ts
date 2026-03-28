import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const contactsTable = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  gender: text("gender"),
  birthdayMonth: integer("birthday_month").notNull(),
  birthdayDay: integer("birthday_day").notNull(),
  birthdayLunar: boolean("birthday_lunar").default(false).notNull(),
  birthYear: integer("birth_year"),
  relation: text("relation"),
  hometown: text("hometown"),
  reminderEmail: text("reminder_email"),
  avatarUrl: text("avatar_url"),
  birthdayEvents: text("birthday_events"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactSchema = createInsertSchema(contactsTable).omit({ id: true, createdAt: true });
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contactsTable.$inferSelect;
