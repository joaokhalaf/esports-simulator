import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

// Append-only snapshots: scenarios always reference the exact imported edition.
export const worldsSnapshot = pgTable(
	"worlds_snapshot",
	{
		id: text("id").primaryKey(),
		payload: jsonb("payload").notNull(),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [index("worlds_snapshot_created_idx").on(t.createdAt)],
);

export const worldsScenario = pgTable(
	"worlds_scenario",
	{
		id: text("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		snapshotId: text("snapshot_id")
			.notNull()
			.references(() => worldsSnapshot.id, { onDelete: "restrict" }),
		name: text("name").notNull(),
		payload: jsonb("payload").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(t) => [
		index("worlds_scenario_owner_idx").on(t.ownerId),
		index("worlds_scenario_snapshot_idx").on(t.snapshotId),
	],
);
