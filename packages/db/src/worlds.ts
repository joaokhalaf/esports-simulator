import { desc, eq, isNotNull } from "drizzle-orm";
import type { Database } from "./index";
import { worldsScenario, worldsSnapshot } from "./schema/worlds";

export async function latestSnapshot(db: Database) {
	return (
		await db
			.select()
			.from(worldsSnapshot)
			.where(isNotNull(worldsSnapshot.publishedAt))
			.orderBy(desc(worldsSnapshot.publishedAt))
			.limit(1)
	)[0];
}
export async function findSnapshot(db: Database, id: string) {
	return (
		await db
			.select()
			.from(worldsSnapshot)
			.where(eq(worldsSnapshot.id, id))
			.limit(1)
	)[0];
}
export async function publishSnapshot(
	db: Database,
	snapshot: { id: string },
	payload: unknown,
) {
	await db
		.insert(worldsSnapshot)
		.values({ id: snapshot.id, payload, publishedAt: new Date() })
		.onConflictDoUpdate({
			target: worldsSnapshot.id,
			set: { publishedAt: new Date() },
		});
}
export async function saveScenario(
	db: Database,
	snapshot: { id: string },
	payload: unknown,
	scenario: { id: string; ownerId: string; name: string; payload: unknown },
) {
	await db.transaction(async (tx) => {
		await tx
			.insert(worldsSnapshot)
			.values({ id: snapshot.id, payload })
			.onConflictDoNothing();
		await tx
			.insert(worldsScenario)
			.values({ ...scenario, snapshotId: snapshot.id });
	});
}
export async function listScenarios(db: Database, ownerId: string) {
	return db
		.select({
			id: worldsScenario.id,
			name: worldsScenario.name,
			createdAt: worldsScenario.createdAt,
		})
		.from(worldsScenario)
		.where(eq(worldsScenario.ownerId, ownerId))
		.orderBy(desc(worldsScenario.createdAt))
		.limit(50);
}
export async function findScenario(db: Database, id: string) {
	return (
		await db
			.select({
				scenario: worldsScenario.payload,
				snapshot: worldsSnapshot.payload,
			})
			.from(worldsScenario)
			.innerJoin(
				worldsSnapshot,
				eq(worldsScenario.snapshotId, worldsSnapshot.id),
			)
			.where(eq(worldsScenario.id, id))
			.limit(1)
	)[0];
}
