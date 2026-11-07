import { desc, eq, isNotNull } from "drizzle-orm";
import type { D1Store } from "./d1/index";
import * as d1 from "./d1/worlds";
import type { Database } from "./index";
import { worldsScenario, worldsSnapshot } from "./schema/worlds";

export type WorldsDatabase = Database | D1Store;
function isD1(db: WorldsDatabase): db is D1Store {
	return "dialect" in db && db.dialect === "d1";
}

export async function latestSnapshot(db: WorldsDatabase) {
	if (isD1(db)) return d1.latestSnapshot(db);
	return (
		await db
			.select()
			.from(worldsSnapshot)
			.where(isNotNull(worldsSnapshot.publishedAt))
			.orderBy(desc(worldsSnapshot.publishedAt))
			.limit(1)
	)[0];
}
export async function findSnapshot(db: WorldsDatabase, id: string) {
	if (isD1(db)) return d1.findSnapshot(db, id);
	return (
		await db
			.select()
			.from(worldsSnapshot)
			.where(eq(worldsSnapshot.id, id))
			.limit(1)
	)[0];
}
export async function publishSnapshot(
	db: WorldsDatabase,
	snapshot: { id: string },
	payload: unknown,
) {
	if (isD1(db)) return d1.publishSnapshot(db, snapshot, payload);
	await db
		.insert(worldsSnapshot)
		.values({ id: snapshot.id, payload, publishedAt: new Date() })
		.onConflictDoUpdate({
			target: worldsSnapshot.id,
			set: { publishedAt: new Date() },
		});
}
export async function saveScenario(
	db: WorldsDatabase,
	snapshot: { id: string },
	payload: unknown,
	scenario: { id: string; ownerId: string; name: string; payload: unknown },
) {
	if (isD1(db)) return d1.saveScenario(db, snapshot, payload, scenario);
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
export async function listScenarios(db: WorldsDatabase, ownerId: string) {
	if (isD1(db)) return d1.listScenarios(db, ownerId);
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
export async function findScenario(db: WorldsDatabase, id: string) {
	if (isD1(db)) return d1.findScenario(db, id);
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
