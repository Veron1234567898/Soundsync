import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: varchar("code", { length: 6 }).notNull().unique(),
  hostId: varchar("host_id").notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sounds = pgTable("sounds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  fileName: text("file_name").notNull(),
  duration: integer("duration").notNull(), // in milliseconds
  roomId: varchar("room_id").references(() => rooms.id).notNull(),
  uploadedBy: varchar("uploaded_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const participants = pgTable("participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  roomId: varchar("room_id").references(() => rooms.id).notNull(),
  isHost: boolean("is_host").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  code: true,
  createdAt: true,
});

export const insertSoundSchema = createInsertSchema(sounds).omit({
  id: true,
  createdAt: true,
});

export const insertParticipantSchema = createInsertSchema(participants).omit({
  id: true,
  joinedAt: true,
});

export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertSound = z.infer<typeof insertSoundSchema>;
export type Sound = typeof sounds.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Participant = typeof participants.$inferSelect;
