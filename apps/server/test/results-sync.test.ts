import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";
import type { D1Database } from "@cloudflare/workers-types";
import { validateSnapshot } from "@esports-simulator/api/worlds/model";
import { createD1Store } from "@esports-simulator/db/d1/index";
import * as repository from "@esports-simulator/db/worlds";
import { syncWorldsResults } from "../src/results-sync";
import { createTestRuntime } from "./runtime";

const seed = validateSnapshot(
	JSON.parse(
		readFileSync(
			new URL("../../../packages/api/src/worlds/seed.json", import.meta.url),
			"utf8",
		),
	),
);

test("automatic collection publishes changes, deduplicates and preserves data on source failure", async () => {
	const mf = await createTestRuntime();
	try {
		const db = createD1Store(
			(await mf.getD1Database("DB")) as unknown as D1Database,
		);
		assert.equal((await syncWorldsResults(db, async () => seed)).changed, true);
		const initial = await repository.latestSnapshot(db);
		assert.equal(
			(await syncWorldsResults(db, async () => seed)).changed,
			false,
		);
		assert.deepEqual(
			(await repository.latestSnapshot(db))?.publishedAt,
			initial?.publishedAt,
		);
		await assert.rejects(
			syncWorldsResults(db, async () => {
				throw new Error("upstream offline");
			}),
		);
		await assert.rejects(
			syncWorldsResults(db, async () => ({ ...seed, matches: [] })),
		);
		assert.equal((await repository.latestSnapshot(db))?.id, seed.id);
		const next = {
			...seed,
			id: "new-stream-version",
			importedAt: "2026-11-11T12:00:00.000Z",
		};
		assert.equal((await syncWorldsResults(db, async () => next)).changed, true);
		assert.equal(
			(await syncWorldsResults(db, async () => seed)).changed,
			false,
		);
		assert.equal((await repository.latestSnapshot(db))?.id, next.id);
	} finally {
		await mf.dispose();
	}
});

test("SSE sends latest database state, resumes by event id and isolates manual Americas coverage", async () => {
	const mf = await createTestRuntime();
	try {
		const db = createD1Store(
			(await mf.getD1Database("DB")) as unknown as D1Database,
		);
		await syncWorldsResults(db, async () => seed);
		async function firstEvent(id?: string) {
			const response = await mf.dispatchFetch("http://localhost/api/stream", {
				headers: id ? { "Last-Event-ID": id } : {},
			});
			assert.match(
				response.headers.get("content-type") ?? "",
				/text\/event-stream/,
			);
			assert.match(response.headers.get("cache-control") ?? "", /no-store/);
			const reader = response.body?.getReader();
			assert.ok(reader);
			let text = "";
			try {
				while (!/event: (worlds|heartbeat)/.test(text)) {
					const part = await reader.read();
					if (part.done) throw new Error("Stream closed before first event");
					text += new TextDecoder().decode(part.value);
				}
			} finally {
				await reader.cancel();
			}
			return text;
		}
		const initial = await firstEvent();
		assert.match(initial, /event: coverage/);
		assert.match(initial, /"americas":"manual"/);
		assert.ok(initial.includes(`id: ${seed.id}`));
		const unchanged = await firstEvent(seed.id);
		assert.match(unchanged, /event: heartbeat/);
		assert.doesNotMatch(unchanged, /event: worlds/);
		const next = {
			...seed,
			id: "changed-between-connections",
			importedAt: "2026-11-11T12:00:00.000Z",
		};
		await syncWorldsResults(db, async () => next);
		assert.ok((await firstEvent(seed.id)).includes(`id: ${next.id}`));
	} finally {
		await mf.dispose();
	}
});

test("an open SSE connection delivers a database update without reconnecting", {
	timeout: 30_000,
}, async () => {
	const mf = await createTestRuntime();
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	try {
		const db = createD1Store(
			(await mf.getD1Database("DB")) as unknown as D1Database,
		);
		await syncWorldsResults(db, async () => seed);
		const response = await mf.dispatchFetch("http://localhost/api/stream");
		reader = response.body?.getReader();
		assert.ok(reader);
		const activeReader = reader;
		let text = "";
		async function readUntil(id: string) {
			while (!text.includes(`id: ${id}`)) {
				const chunk = await activeReader.read();
				assert.equal(chunk.done, false, "stream must stay open for the update");
				text += new TextDecoder().decode(chunk.value);
			}
		}
		await readUntil(seed.id);
		const next = {
			...seed,
			id: "updated-during-open-stream",
			importedAt: "2026-11-11T13:00:00.000Z",
		};
		await syncWorldsResults(db, async () => next);
		await readUntil(next.id);
		assert.ok(text.includes(`id: ${seed.id}`));
		assert.ok(text.includes(`id: ${next.id}`));
	} finally {
		await reader?.cancel();
		await mf.dispose();
	}
});
