import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import "varlock/auto-load";

export default Alchemy.Stack(
	"esports-simulator",
	{ providers: Cloudflare.providers(), state: Cloudflare.state() },
	Effect.gen(function* () {
		const database = yield* Cloudflare.D1.Database("worlds", {
			migrations: "../../packages/db/src/d1/migrations",
		});
		const web = yield* Cloudflare.Worker("web", {
			main: "../../apps/server/src/worker.ts",
			compatibility: { date: "2026-10-27", flags: ["nodejs_compat"] },
			assets: {
				directory: "../../apps/web/dist",
				htmlHandling: "auto-trailing-slash",
				notFoundHandling: "single-page-application",
				runWorkerFirst: [
					"/rpc",
					"/rpc/*",
					"/api/*",
					"/api-reference",
					"/api-reference/*",
					"/health",
				],
			},
			env: {
				DB: database,
				PUBLIC_URL: Cloudflare.Worker.URL,
				BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
				ADMIN_USER_IDS: Config.String("ADMIN_USER_IDS").pipe(
					Config.withDefault(""),
				),
			},
		});
		return { web: web.url, database: database.databaseName };
	}),
);
