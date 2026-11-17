import * as repository from "@esports-simulator/db/vct";
import type { WorldsDatabase } from "@esports-simulator/db/worlds";
import { validateVctSnapshot } from "./results";
import { collectVlrBrazil } from "./vlr";

export function vctPollInterval(now: Date) {
	return now.getTime() >= Date.parse("2026-11-05T00:00:00Z") &&
		now.getTime() <= Date.parse("2026-12-07T00:00:00Z")
		? 5 * 60_000
		: 24 * 60 * 60_000;
}
export async function syncBrazilResults(
	db: WorldsDatabase,
	collect = collectVlrBrazil,
	now = new Date(),
) {
	const stored = await repository.latestBrazilResults(db);
	const current = stored ? validateVctSnapshot(stored) : undefined;
	if (
		current &&
		now.getTime() - Date.parse(current.collectedAt) < vctPollInterval(now)
	)
		return { changed: false, snapshot: current };
	const snapshot = validateVctSnapshot(await collect());
	if (Date.parse(snapshot.collectedAt) > now.getTime() + 60_000)
		throw new Error("Future VLR snapshot");
	if (current) {
		if (Date.parse(snapshot.collectedAt) <= Date.parse(current.collectedAt))
			return { changed: false, snapshot: current };
		for (const match of current.matches) {
			const next = snapshot.matches.find((m) => m.id === match.id);
			if (
				!next ||
				(match.status === "completed" && next.status !== "completed") ||
				(match.outcome.kind !== "unavailable" &&
					next.outcome.kind === "unavailable")
			)
				throw new Error("Regressive VLR snapshot");
		}
	}
	await repository.publishBrazilResults(db, snapshot);
	const published = validateVctSnapshot(
		await repository.latestBrazilResults(db),
	);
	return { changed: published.id !== current?.id, snapshot: published };
}
