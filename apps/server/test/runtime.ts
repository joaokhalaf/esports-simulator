import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

// Only local, ephemeral databases are used by this harness. No provider credentials.
export async function createTestRuntime(port?: number) {
	const mf = new Miniflare(
		convertV4MiniflareOptions({
			modules: true,
			host: "127.0.0.1",
			port: port ?? 0,
			scriptPath: "dist-worker/worker.js",
			compatibilityDate: "2026-10-27",
			compatibilityFlags: ["nodejs_compat"],
			d1Databases: ["DB"],
			bindings: {
				PUBLIC_URL: port ? `http://localhost:${port}` : "http://localhost",
				BETTER_AUTH_SECRET: "cloudflare-integration-only-secret-123456789",
			},
			assets: {
				directory: "../web/dist",
				binding: "ASSETS",
				assetConfig: { not_found_handling: "single-page-application" },
				routerConfig: {
					has_user_worker: true,
					invoke_user_worker_ahead_of_assets: true,
				},
			},
		}),
	);
	try {
		const binding = await mf.getD1Database("DB");
		const schema = readFileSync(
			new URL(
				"../../../packages/db/src/d1/migrations/0001_initial.sql",
				import.meta.url,
			),
			"utf8",
		);
		await binding.batch(
			schema
				.split(";")
				.map((s) => s.trim())
				.filter(Boolean)
				.map((s) => binding.prepare(s)),
		);
		await mf.ready;
		return mf;
	} catch (error) {
		await mf.dispose();
		throw error;
	}
}
