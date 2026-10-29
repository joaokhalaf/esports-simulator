import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createDb } from "@esports-simulator/db";
import { createRouterClient } from "@orpc/server";
import type { Context } from "../src/context";
import { worldsRouter } from "../src/routers/worlds";
import { RULES_VERSION, validateSnapshot } from "../src/worlds/model";

test("persistence isolates owners, restricts administration and keeps shared snapshots immutable", {
	skip: !process.env.TEST_DATABASE_URL,
}, async () => {
	const url = process.env.TEST_DATABASE_URL ?? "";
	const parsed = new URL(url);
	assert.ok(
		["localhost", "127.0.0.1"].includes(parsed.hostname) &&
			parsed.pathname === "/worlds_mvp",
		"integration writes require an isolated local test database",
	);
	const db = createDb({ DATABASE_URL: url });
	const id = randomUUID();
	const otherId = randomUUID();
	let publishedId: string | undefined;
	const now = new Date();
	const session: NonNullable<Context["session"]> = {
		user: {
			id,
			name: "Integration",
			email: `${id}@example.com`,
			emailVerified: false,
			createdAt: now,
			updatedAt: now,
			image: null,
		},
		session: {
			id: randomUUID(),
			userId: id,
			token: randomUUID(),
			expiresAt: new Date(Date.now() + 60000),
			createdAt: now,
			updatedAt: now,
			ipAddress: null,
			userAgent: null,
		},
	};
	const context: Context = { db, session, isAdmin: false };
	const member = createRouterClient(worldsRouter, { context });
	const guest = createRouterClient(worldsRouter, {
		context: { ...context, session: null },
	});
	const admin = createRouterClient(worldsRouter, {
		context: { ...context, isAdmin: true },
	});
	const other = createRouterClient(worldsRouter, {
		context: {
			...context,
			session: { ...session, user: { ...session.user, id: otherId } },
		},
	});
	const snapshot = validateSnapshot(
		JSON.parse(
			readFileSync(new URL("../src/worlds/seed.json", import.meta.url), "utf8"),
		),
	);
	const scenario = {
		name: "Frozen scenario",
		mode: "current" as const,
		seed: 42,
		rulesVersion: RULES_VERSION,
		picks: {},
	};
	try {
		await db.$client.query(
			'INSERT INTO "user" (id,name,email,email_verified) VALUES ($1,$2,$3,false)',
			[id, "Integration", session.user.email],
		);
		await assert.rejects(
			guest.save({ snapshotId: snapshot.id, scenario }),
			(error: unknown) => (error as { code: string }).code === "UNAUTHORIZED",
		);
		await assert.rejects(
			member.publish({ snapshot }),
			(error: unknown) => (error as { code: string }).code === "FORBIDDEN",
		);
		const saved = await member.save({ snapshotId: snapshot.id, scenario });
		assert.ok((await member.mine()).some((s) => s.id === saved.id));
		assert.equal((await other.mine()).length, 0);
		const before = await guest.shared({ id: saved.id });
		assert.deepEqual(before.snapshot, snapshot);
		assert.deepEqual(before.scenario, scenario);
		const correction = structuredClone(snapshot);
		const first = correction.teams[0];
		assert.ok(first);
		first.name = `Corrected ${id}`;
		const published = await admin.publish({ snapshot: correction });
		publishedId = published.id;
		assert.notEqual(published.id, snapshot.id);
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
			(error: unknown) => (error as { code: string }).code === "BAD_REQUEST",
		);
	} finally {
		await db.$client.query('DELETE FROM "user" WHERE id=$1', [id]);
		if (publishedId)
			await db.$client.query("DELETE FROM worlds_snapshot WHERE id=$1", [
				publishedId,
			]);
		await db.$client.end();
	}
});
