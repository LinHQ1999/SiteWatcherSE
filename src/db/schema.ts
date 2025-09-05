import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const siteTable = sqliteTable("site_table", {
  id: int().primaryKey({ autoIncrement: true }),
  site: text().notNull(),
  timestamp: int().notNull(),
  parsed: text()
});
