import type { D1Database, Fetcher } from "@cloudflare/workers-types";
import { createCloudflareAuth } from "@esports-simulator/auth/cloudflare";
import { createD1Store } from "@esports-simulator/db/d1/index";
import { createApp } from "./app";

export type WorkerEnv = {
	DB: D1Database;
	ASSETS: Pick<Fetcher, "fetch">;
	PUBLIC_URL: string;
	BETTER_AUTH_SECRET: string;
	ADMIN_USER_IDS?: string;
};

export default {
	async fetch(request: Request, env: WorkerEnv): Promise<Response> {
		const path = new URL(request.url).pathname;
		if (path === "/health") return new Response("OK");
		if (
			path === "/rpc" ||
			path.startsWith("/rpc/") ||
			path.startsWith("/api/") ||
			path === "/api-reference" ||
			path.startsWith("/api-reference/")
		) {
			const auth = createCloudflareAuth(
				{
					BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
					BETTER_AUTH_URL: env.PUBLIC_URL,
					CORS_ORIGIN: env.PUBLIC_URL,
				},
				env.DB,
			);
			const app = createApp(
				{ db: createD1Store(env.DB), auth },
				{
					CORS_ORIGIN: env.PUBLIC_URL,
					ADMIN_USER_IDS: env.ADMIN_USER_IDS,
				},
			);
			return app.fetch(request);
		}
		return env.ASSETS.fetch(request);
	},
};
