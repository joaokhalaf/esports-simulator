import { eq, lt } from "drizzle-orm";
import type { D1Store } from "./d1/index";
import { vctResults } from "./schema/vct";
import type { WorldsDatabase } from "./worlds";

function isD1(db: WorldsDatabase): db is D1Store {
	return "dialect" in db && db.dialect === "d1";
}

export async function latestBrazilResults(
	db: WorldsDatabase,
): Promise<unknown | undefined> {
	if (isD1(db)) {
		const row = await db.binding
			.prepare("SELECT payload FROM vct_results WHERE id = ?")
			.bind("brazil")
			.first<{ payload: string }>();
		return row ? JSON.parse(row.payload) : undefined;
	}
	return (
		await db
			.select({ payload: vctResults.payload })
			.from(vctResults)
			.where(eq(vctResults.id, "brazil"))
			.limit(1)
	)[0]?.payload;
}
export async function publishBrazilResults(
	db: WorldsDatabase,
	snapshot: { collectedAt: string },
) {
	const collectedAt = new Date(snapshot.collectedAt);
	if (isD1(db)) {
		await db.binding
			.prepare(
				"INSERT INTO vct_results (id, payload, collected_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, collected_at = excluded.collected_at WHERE excluded.collected_at > vct_results.collected_at",
			)
			.bind("brazil", JSON.stringify(snapshot), collectedAt.getTime())
			.run();
		return;
	}
	await db
		.insert(vctResults)
		.values({ id: "brazil", payload: snapshot, collectedAt })
		.onConflictDoUpdate({
			target: vctResults.id,
			set: { payload: snapshot, collectedAt },
			setWhere: lt(vctResults.collectedAt, collectedAt),
		});
}
