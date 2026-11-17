import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const vctResults = pgTable("vct_results", {
	id: text("id").primaryKey(),
	payload: jsonb("payload").notNull(),
	collectedAt: timestamp("collected_at", { withTimezone: true }).notNull(),
});
