import { number } from "@inquirer/prompts";
import { index, int, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const siteTable = sqliteTable("site_table", {
  id: int().primaryKey({ autoIncrement: true }),
  site: text().notNull(),
  site_title: text(),
  timestamp: int().notNull(),
  parsed: text().unique(),
}, (self) => [index("site_idx").on(self.site)]);

export const stateTable = sqliteTable("browser_state_table", {
  id: int().primaryKey({ autoIncrement: true }),
  profile: text().notNull().unique(),
  state: text().notNull()
});

export const videoTable = sqliteTable("video_table", {
  id: int().primaryKey({ autoIncrement: true }),
  profile: text().unique(),
  chapter: int(),
  section: int()
}, s => [unique("progress").on(s.chapter, s.section)]);
