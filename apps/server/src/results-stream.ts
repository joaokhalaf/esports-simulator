import { americasSnapshotVersion } from "@esports-simulator/api/vct/published";
import { validateVctSnapshot } from "@esports-simulator/api/vct/results";
import { validateSnapshot } from "@esports-simulator/api/worlds/model";
import seed from "@esports-simulator/api/worlds/seed.json";
import { latestBrazilResults } from "@esports-simulator/db/vct";
import * as repository from "@esports-simulator/db/worlds";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

/** The database is shared across Worker instances; no process-local broadcast state. */
export function resultsStream(c: Context, db: repository.WorldsDatabase) {
	const response = streamSSE(c, async (stream) => {
		let last = c.req.header("Last-Event-ID") ?? "";
		let lastBrazil = "";
		let wake: (() => void) | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		stream.onAbort(() => {
			clearTimeout(timer);
			wake?.();
		});
		await stream.writeSSE({
			event: "coverage",
			data: JSON.stringify({
				worlds: "automatic",
				americas: "manual",
				americasVersion: americasSnapshotVersion,
				brazil: "automatic-vlr",
			}),
			retry: 3000,
		});
		// Rotate connections after 45s. EventSource reconnects and gets the latest version,
		// even if events were missed, the Worker restarted, or another instance collected them.
		for (let tick = 0; tick < 4 && !stream.aborted; tick++) {
			try {
				const row = await repository.latestSnapshot(db);
				const snapshot = row
					? validateSnapshot(row.payload)
					: validateSnapshot(seed);
				if (snapshot.id !== last) {
					await stream.writeSSE({
						event: "worlds",
						id: snapshot.id,
						data: JSON.stringify(snapshot),
					});
					last = snapshot.id;
				} else {
					await stream.writeSSE({ event: "heartbeat", data: "{}" });
				}
			} catch {
				if (!stream.aborted)
					await stream.writeSSE({
						event: "unavailable",
						data: JSON.stringify({
							message:
								"Últimos resultados preservados; nova tentativa em instantes.",
						}),
					});
			}
			if (tick < 3 && !stream.aborted)
				try {
					const payload = await latestBrazilResults(db);
					if (payload) {
						const snapshot = validateVctSnapshot(payload);
						if (snapshot.id !== lastBrazil) {
							await stream.writeSSE({
								event: "brazil",
								data: JSON.stringify(snapshot),
							});
							lastBrazil = snapshot.id;
						}
					}
				} catch {
					if (!stream.aborted)
						await stream.writeSSE({ event: "brazil-unavailable", data: "{}" });
				}
			if (tick < 3 && !stream.aborted)
				await new Promise<void>((resolve) => {
					wake = resolve;
					timer = setTimeout(resolve, 15_000);
				});
		}
		clearTimeout(timer);
	});
	c.header("Cache-Control", "no-cache, no-store, no-transform");
	response.headers.set("Cache-Control", "no-cache, no-store, no-transform");
	c.header("X-Accel-Buffering", "no");
	response.headers.set("X-Accel-Buffering", "no");
	return response;
}
