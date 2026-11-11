import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { ENV } from "./env.server";
import { RESULTS_SYNC_INTERVAL, syncWorldsResults } from "./results-sync";
import { auth, db } from "./services";

const app = createApp({ auth, db }, ENV);
serve({ fetch: app.fetch, port: ENV.PORT }, (info) => {
	console.log(`Server is running on http://localhost:${info.port}`);
});

// Tests use deterministic fixtures. Production Node and local development collect automatically.
if (process.env.NODE_ENV !== "test") {
	let running = false;
	const sync = async () => {
		if (running) return;
		running = true;
		try {
			await syncWorldsResults(db);
		} catch {
			console.error(
				"Falha na sincronização do Worlds; últimos dados preservados.",
			);
		} finally {
			running = false;
		}
	};
	void sync();
	const timer = setInterval(() => {
		void sync();
	}, RESULTS_SYNC_INTERVAL);
	timer.unref();
	for (const signal of ["SIGINT", "SIGTERM"] as const)
		process.on(signal, () => clearInterval(timer));
}
