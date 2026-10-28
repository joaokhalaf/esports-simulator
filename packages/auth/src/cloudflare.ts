import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { D1Database } from "@cloudflare/workers-types";
import * as schema from "@esports-simulator/db/d1/auth-schema";
import { betterAuth } from "better-auth/minimal";
import { defineRelations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { AuthConfig } from "./index";

export function createCloudflareAuth(env: AuthConfig, binding: D1Database) {
	const database = drizzle(binding, {
		relations: { ...defineRelations(schema), ...schema.authRelations },
	});
	return betterAuth({
		database: drizzleAdapter(database, {
			provider: "sqlite",
			schema,
			transaction: false,
		}),
		trustedOrigins: [env.CORS_ORIGIN],
		emailAndPassword: { enabled: true },
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		advanced: {
			defaultCookieAttributes: {
				sameSite: "lax",
				secure: env.BETTER_AUTH_URL.startsWith("https:"),
				httpOnly: true,
			},
		},
	});
}
