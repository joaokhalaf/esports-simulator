import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";
import type { D1Database } from "@cloudflare/workers-types";
import { worldsRouter } from "@esports-simulator/api/routers/worlds";
import {
	RULES_VERSION,
	type Scenario,
	validateSnapshot,
} from "@esports-simulator/api/worlds/model";
import { createD1Store } from "@esports-simulator/db/d1/index";
import * as repository from "@esports-simulator/db/worlds";
import { createRouterClient } from "@orpc/server";
import { createTestRuntime } from "./runtime";

const snapshot = validateSnapshot(
	JSON.parse(
		readFileSync(
			new URL("../../../packages/api/src/worlds/seed.json", import.meta.url),
			"utf8",
		),
	),
);
const scenario: Scenario = {
	name: "D1 scenario",
	mode: "current" as const,
	seed: 42,
	rulesVersion: RULES_VERSION,
	picks: {},
};

test("Cloudflare Worker serves the SPA and API, authenticates on D1, and preserves snapshot isolation", async () => {
	const mf = await createTestRuntime();
	try {
		const binding = await mf.getD1Database("DB");
		const store = createD1Store(binding as unknown as D1Database);
		const home = await mf.dispatchFetch("http://localhost/");
		assert.equal(home.status, 200);
		assert.match(await home.text(), /<div id="app">/);
		const deepLink = await mf.dispatchFetch("http://localhost/login");
		assert.equal(deepLink.status, 200);
		assert.match(await deepLink.text(), /<div id="app">/);
		const health = await mf.dispatchFetch("http://localhost/health");
		assert.equal(await health.text(), "OK");
		const rpc = await mf.dispatchFetch("http://localhost/rpc/worlds/latest", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ json: {} }),
		});
		assert.equal(rpc.status, 200, await rpc.clone().text());
		assert.ok((await rpc.text()).includes(snapshot.id));
		const absent = await mf.dispatchFetch("http://localhost/rpc/missing", {
			method: "POST",
		});
		assert.notEqual(absent.headers.get("content-type"), "text/html");
		// Use the actual Worker auth endpoint to exercise SQLite date/boolean mappings.
		const signup = await mf.dispatchFetch(
			"http://localhost/api/auth/sign-up/email",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: "http://localhost",
				},
				body: JSON.stringify({
					name: "D1 User",
					email: "d1@example.com",
					password: "test-password-123456789",
				}),
			},
		);
		assert.equal(signup.status, 200, await signup.clone().text());
		const cookies = signup.headers.get("set-cookie");
		assert.ok(cookies);
		const sessionResponse = await mf.dispatchFetch(
			"http://localhost/api/auth/get-session",
			{ headers: { Cookie: cookies } },
		);
		assert.equal(sessionResponse.status, 200);
		const session = (await sessionResponse.json()) as {
			user: { id: string; email: string };
			session: { id: string };
		};
		assert.equal(session.user.email, "d1@example.com");
		// Fetch the session through the adapter so the router receives native Date fields.
		const { createCloudflareAuth } = await import(
			"@esports-simulator/auth/cloudflare"
		);
		const auth = createCloudflareAuth(
			{
				BETTER_AUTH_SECRET: "cloudflare-integration-only-secret-123456789",
				BETTER_AUTH_URL: "http://localhost",
				CORS_ORIGIN: "http://localhost",
			},
			binding as unknown as D1Database,
		);
		const authenticated = await auth.api.getSession({
			headers: new Headers({ Cookie: cookies }),
		});
		assert.ok(authenticated);
		const guest = createRouterClient(worldsRouter, {
			context: { db: store, session: null, isAdmin: false },
		});
		const member = createRouterClient(worldsRouter, {
			context: { db: store, session: authenticated, isAdmin: false },
		});
		const admin = createRouterClient(worldsRouter, {
			context: { db: store, session: authenticated, isAdmin: true },
		});
		await assert.rejects(guest.save({ snapshotId: snapshot.id, scenario }), {
			code: "UNAUTHORIZED",
		});
		await assert.rejects(member.publish({ snapshot }), { code: "FORBIDDEN" });
		const saved = await member.save({ snapshotId: snapshot.id, scenario });
		assert.equal((await member.mine())[0]?.id, saved.id);
		assert.deepEqual(
			await repository.listScenarios(store, "another-owner"),
			[],
		);
		const before = await guest.shared({ id: saved.id });
		assert.deepEqual(before, { snapshot, scenario });
		const changed = structuredClone(snapshot);
		const team = changed.teams[0];
		assert.ok(team);
		team.name = "Updated D1";
		const published = await admin.publish({ snapshot: changed });
		assert.equal((await guest.latest()).snapshot.id, published.id);
		assert.deepEqual(await guest.shared({ id: saved.id }), before);
		await assert.rejects(
			member.save({
				snapshotId: snapshot.id,
				scenario: {
					...scenario,
					picks: { invalid: { teams: ["a", "b"], score: [3, 0] } },
				},
			}),
			{ code: "BAD_REQUEST" },
		);
		// A failed second statement must roll back the first statement in the same D1 batch.
		await assert.rejects(
			repository.saveScenario(
				store,
				{ id: "rollback-snapshot" },
				{},
				{
					id: "rollback-scenario",
					ownerId: "missing-owner",
					name: "Invalid",
					payload: {},
				},
			),
		);
		assert.equal(
			await repository.findSnapshot(store, "rollback-snapshot"),
			undefined,
		);
	} finally {
		await mf.dispose();
	}
});
