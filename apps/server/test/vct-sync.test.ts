import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";
import type { D1Database } from "@cloudflare/workers-types";
import { syncBrazilResults } from "@esports-simulator/api/vct/sync";
import { collectVlrBrazil } from "@esports-simulator/api/vct/vlr";
import { createD1Store } from "@esports-simulator/db/d1/index";
import {
	latestBrazilResults,
	publishBrazilResults,
} from "@esports-simulator/db/vct";
import { createTestRuntime } from "./runtime";

const now = new Date("2026-11-17T21:00:00Z");
async function fixture() {
	return collectVlrBrazil(
		(async (url) =>
			new Response(
				readFileSync(
					new URL(
						`../../../packages/api/test/fixtures/vlr-brazil-${String(url).includes("/3187/") ? "open" : "playoffs"}.html.txt`,
						import.meta.url,
					),
					"utf8",
				),
				{ headers: { "Content-Type": "text/html" } },
			)) as typeof fetch,
		now,
	);
}
test("D1 cache survives failures and fresh adapters; TTL, regression and timestamp guards preserve last valid data", async () => {
	const mf = await createTestRuntime();
	try {
		const binding = (await mf.getD1Database("DB")) as unknown as D1Database;
		const db = createD1Store(binding);
		const snapshot = await fixture();
		assert.equal(
			(await syncBrazilResults(db, async () => snapshot, now)).changed,
			true,
		);
		let called = false;
		await syncBrazilResults(
			db,
			async () => {
				called = true;
				throw new Error("must stay cached");
			},
			now,
		);
		assert.equal(called, false);
		const later = new Date(now.getTime() + 360_000);
		await assert.rejects(
			syncBrazilResults(
				db,
				async () => {
					throw new Error("offline");
				},
				later,
			),
		);
		await assert.rejects(
			syncBrazilResults(
				db,
				async () => ({
					...snapshot,
					collectedAt: later.toISOString(),
					matches: [],
				}),
				later,
			),
		);
		assert.deepEqual(
			await latestBrazilResults(createD1Store(binding)),
			snapshot,
		);
		await assert.rejects(
			syncBrazilResults(
				db,
				async () => ({
					...snapshot,
					collectedAt: later.toISOString(),
					events: snapshot.events.map((e) =>
						e.id === 3187 ? { ...e, count: e.count - 1 } : e,
					),
					matches: snapshot.matches.slice(1),
				}),
				later,
			),
			/Regressive/,
		);
		await assert.rejects(
			syncBrazilResults(
				db,
				async () => ({
					...snapshot,
					collectedAt: later.toISOString(),
					matches: snapshot.matches.map((m, i) =>
						i === 0 ? { ...m, status: "live" as const } : m,
					),
				}),
				later,
			),
			/Regressive/,
		);
		await assert.rejects(
			syncBrazilResults(
				db,
				async () => ({
					...snapshot,
					collectedAt: new Date(later.getTime() + 120_000).toISOString(),
				}),
				later,
			),
			/Future/,
		);
		const newer = { ...snapshot, collectedAt: later.toISOString() };
		assert.equal(
			(await syncBrazilResults(db, async () => newer, later)).changed,
			false,
		);
		assert.deepEqual(await latestBrazilResults(db), newer);
		await publishBrazilResults(db, snapshot);
		assert.deepEqual(await latestBrazilResults(db), newer);
		const response = await mf.dispatchFetch("http://localhost/rpc/vct/brazil", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: '{"json":{}}',
		});
		assert.equal(response.status, 200);
		assert.ok((await response.text()).includes(snapshot.id));
	} finally {
		await mf.dispose();
	}
});
test("SSE publishes Brazil without replacing Worlds event IDs", async () => {
	const mf = await createTestRuntime();
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	try {
		const db = createD1Store(
			(await mf.getD1Database("DB")) as unknown as D1Database,
		);
		const snapshot = await fixture();
		await syncBrazilResults(db, async () => snapshot, now);
		const response = await mf.dispatchFetch("http://localhost/api/stream");
		reader = response.body?.getReader();
		assert.ok(reader);
		let text = "";
		while (!text.includes("event: brazil\n")) {
			const part = await reader.read();
			assert.equal(part.done, false);
			text += new TextDecoder().decode(part.value);
		}
		assert.match(text, /event: worlds/);
		assert.ok(text.includes(snapshot.id));
		assert.ok(!text.includes(`id: ${snapshot.id}`));
	} finally {
		await reader?.cancel();
		await mf.dispose();
	}
});
