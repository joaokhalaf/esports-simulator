import type { D1Store } from "./index";

type SnapshotRow = {
	id: string;
	payload: string;
	published_at: number | null;
	created_at: number;
};
function snapshot(row: SnapshotRow | null) {
	return row
		? {
				id: row.id,
				payload: JSON.parse(row.payload) as unknown,
				publishedAt:
					row.published_at === null ? null : new Date(row.published_at),
				createdAt: new Date(row.created_at),
			}
		: undefined;
}
export async function latestSnapshot(db: D1Store) {
	return snapshot(
		await db.binding
			.prepare(
				"SELECT * FROM worlds_snapshot WHERE published_at IS NOT NULL ORDER BY published_at DESC LIMIT 1",
			)
			.first<SnapshotRow>(),
	);
}
export async function findSnapshot(db: D1Store, id: string) {
	return snapshot(
		await db.binding
			.prepare("SELECT * FROM worlds_snapshot WHERE id = ? LIMIT 1")
			.bind(id)
			.first<SnapshotRow>(),
	);
}
export async function publishSnapshot(
	db: D1Store,
	data: { id: string },
	payload: unknown,
) {
	await db.binding
		.prepare(
			"INSERT INTO worlds_snapshot (id, payload, published_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET published_at = excluded.published_at",
		)
		.bind(data.id, JSON.stringify(payload), Date.now())
		.run();
}
export async function saveScenario(
	db: D1Store,
	data: { id: string },
	payload: unknown,
	scenario: { id: string; ownerId: string; name: string; payload: unknown },
) {
	// D1 batches commit together; an invalid owner must also roll back snapshot insertion.
	await db.binding.batch([
		db.binding
			.prepare(
				"INSERT INTO worlds_snapshot (id, payload) VALUES (?, ?) ON CONFLICT(id) DO NOTHING",
			)
			.bind(data.id, JSON.stringify(payload)),
		db.binding
			.prepare(
				"INSERT INTO worlds_scenario (id, owner_id, snapshot_id, name, payload) VALUES (?, ?, ?, ?, ?)",
			)
			.bind(
				scenario.id,
				scenario.ownerId,
				data.id,
				scenario.name,
				JSON.stringify(scenario.payload),
			),
	]);
}
export async function listScenarios(db: D1Store, ownerId: string) {
	const { results } = await db.binding
		.prepare(
			"SELECT id, name, created_at FROM worlds_scenario WHERE owner_id = ? ORDER BY created_at DESC LIMIT 50",
		)
		.bind(ownerId)
		.all<{ id: string; name: string; created_at: number }>();
	return results.map((row) => ({
		id: row.id,
		name: row.name,
		createdAt: new Date(row.created_at),
	}));
}
export async function findScenario(db: D1Store, id: string) {
	const row = await db.binding
		.prepare(
			"SELECT s.payload AS scenario, p.payload AS snapshot FROM worlds_scenario s JOIN worlds_snapshot p ON p.id = s.snapshot_id WHERE s.id = ? LIMIT 1",
		)
		.bind(id)
		.first<{ scenario: string; snapshot: string }>();
	return row
		? {
				scenario: JSON.parse(row.scenario) as unknown,
				snapshot: JSON.parse(row.snapshot) as unknown,
			}
		: undefined;
}
