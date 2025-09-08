import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const siteTable = sqliteTable("site_table", {
  id: int().primaryKey({ autoIncrement: true }),
  site: text().notNull(),
  timestamp: int().notNull(),
  parsed: text()
});

export const stateTable = sqliteTable("browser_state_table", {
  id: int().primaryKey({ autoIncrement: true }),
  profile: text().notNull().unique(),
  state: text().notNull()
});
