import * as repository from "@esports-simulator/db/worlds";
import { validateSnapshot } from "./model";
import { importWorlds } from "./riot";

/** Only publish validated, changed snapshots. Source failures leave the database untouched. */
export async function syncWorldsResults(
	db: repository.WorldsDatabase,
	collect = importWorlds,
) {
	const snapshot = validateSnapshot(await collect());
	const current = await repository.latestSnapshot(db);
	if (current?.id === snapshot.id)
		return {
			changed: false,
			id: snapshot.id,
			snapshot: validateSnapshot(current.payload),
		};
	if (
		current &&
		new Date(validateSnapshot(current.payload).importedAt).getTime() >
			new Date(snapshot.importedAt).getTime()
	) {
		return {
			changed: false,
			id: current.id,
			snapshot: validateSnapshot(current.payload),
		};
	}
	await repository.publishSnapshot(db, snapshot, snapshot);
	return { changed: true, id: snapshot.id, snapshot };
}
