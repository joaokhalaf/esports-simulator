import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createDb } from "@esports-simulator/db";
import {
	latestBrazilResults,
	publishBrazilResults,
} from "@esports-simulator/db/vct";
import { createRouterClient } from "@orpc/server";
import { vctRouter } from "../src/routers/vct";
import { validateVctSnapshot } from "../src/vct/results";
import { collectVlrBrazil, parseVlrEvent, VLR_MAX_BYTES } from "../src/vct/vlr";

const open = readFileSync(
	new URL("./fixtures/vlr-brazil-open.html.txt", import.meta.url),
	"utf8",
);
const playoffs = readFileSync(
	new URL("./fixtures/vlr-brazil-playoffs.html.txt", import.meta.url),
	"utf8",
);
const now = new Date("2026-11-17T21:00:00Z");
const fixtureFetch = (async (url: string | URL | Request) =>
	new Response(String(url).includes("/3187/") ? open : playoffs, {
		headers: { "Content-Type": "text/html" },
	})) as typeof fetch;

test("PostgreSQL migration, conditional cache write and public read adapter", {
	skip: !process.env.TEST_DATABASE_URL,
}, async () => {
	const url = process.env.TEST_DATABASE_URL ?? "";
	const parsed = new URL(url);
	assert.ok(
		["localhost", "127.0.0.1"].includes(parsed.hostname) &&
			parsed.pathname === "/worlds_mvp",
	);
	const db = createDb({ DATABASE_URL: url });
	try {
		const snapshot = await collectVlrBrazil(fixtureFetch, now);
		await publishBrazilResults(db, snapshot);
		await publishBrazilResults(db, {
			...snapshot,
			collectedAt: new Date(now.getTime() - 1000).toISOString(),
		});
		assert.deepEqual(await latestBrazilResults(db), snapshot);
		const client = createRouterClient(vctRouter, {
			context: { db, session: null, isAdmin: false },
		});
		assert.deepEqual((await client.brazil()).snapshot, snapshot);
	} finally {
		await db.$client.query("DELETE FROM vct_results WHERE id = $1", ["brazil"]);
		await db.$client.end();
	}
});

test("real VLR fixtures preserve all 429 records, qualifiers and missing outcomes", () => {
	const page = parseVlrEvent(open, 3187);
	assert.equal(page.count, 429);
	assert.equal(
		page.matches.find((m) => m.id === "vlr-791184")?.outcome.kind,
		"unavailable",
	);
	assert.equal(
		page.matches.find((m) => m.id === "vlr-789281")?.outcome.kind,
		"unavailable",
	);
	assert.ok(page.matches.some((m) => m.stage === "Qualifier #1"));
	assert.ok(page.matches.some((m) => m.stage === "Qualifier #2"));
	assert.deepEqual(parseVlrEvent(playoffs, 3183), {
		id: 3183,
		count: 0,
		matches: [],
	});
});
test("wrong event, changed count, duplicate matches, invalid scores/status/links fail closed", () => {
	assert.throws(() => parseVlrEvent(open, 3183));
	assert.throws(() => parseVlrEvent(open.replace("(429)", "(430)"), 3187));
	assert.throws(() =>
		parseVlrEvent(open.replace("/787276/", "/787275/"), 3187),
	);
	assert.throws(() =>
		parseVlrEvent(
			open.replace('href="/787275/', 'href="https://evil.invalid/787275/'),
			3187,
		),
	);
	assert.throws(() =>
		parseVlrEvent(open.replace("Completed", "Unknown"), 3187),
	);
	assert.throws(() =>
		parseVlrEvent(
			open.replace(/(match-item-vs-team-score[^>]*>\s*)2/, "$1bogus"),
			3187,
		),
	);
	assert.throws(() => parseVlrEvent("<h1>Challenge</h1>", 3187));
});
test("live scores remain partial; explicit forfeits have a winner and no map score", () => {
	const live = parseVlrEvent(open.replace("Completed", "LIVE"), 3187)
		.matches[0];
	assert.equal(live?.status, "live");
	const forfeit = parseVlrEvent(
		open.replace(
			'<div class="match-item-note"> </div>',
			'<div class="match-item-note">forfeit</div>',
		),
		3187,
	).matches[0];
	assert.deepEqual(forfeit?.outcome, { kind: "forfeit", winner: 0 });
	assert.equal(
		parseVlrEvent(
			open.replace(
				'<div class="match-item-note"> </div>',
				'<div class="match-item-note">won the series</div>',
			),
			3187,
		).matches[0]?.outcome.kind,
		"reported-score",
	);
});
test("collector uses fixed HTTPS URLs, rejects redirects and produces stable content versions", async () => {
	const requests: string[] = [];
	const fetcher = (async (url, options) => {
		requests.push(String(url));
		assert.equal(options?.redirect, "error");
		assert.ok(options?.signal);
		return fixtureFetch(url, options);
	}) as typeof fetch;
	const first = await collectVlrBrazil(fetcher, now);
	const next = await collectVlrBrazil(
		fixtureFetch,
		new Date(now.getTime() + 300_000),
	);
	assert.equal(first.id, next.id);
	assert.notEqual(first.collectedAt, next.collectedAt);
	assert.equal(requests.length, 2);
	assert.ok(
		requests.every(
			(u) =>
				u.startsWith("https://www.vlr.gg/event/matches/") &&
				u.endsWith("?series_id=all"),
		),
	);
	assert.deepEqual(
		validateVctSnapshot(JSON.parse(JSON.stringify(first))),
		first,
	);
	assert.throws(() =>
		validateVctSnapshot({ ...first, matches: first.matches.slice(1) }),
	);
});
test("upstream errors, non-HTML, oversized bodies and partial event failures reject collection", async () => {
	for (const response of [
		new Response("denied", { status: 403 }),
		new Response("{}", { headers: { "Content-Type": "application/json" } }),
		new Response("x".repeat(VLR_MAX_BYTES + 1), {
			headers: { "Content-Type": "text/html" },
		}),
	]) {
		await assert.rejects(
			collectVlrBrazil((async () => response) as typeof fetch, now),
		);
	}
	await assert.rejects(
		collectVlrBrazil(
			(async (url) =>
				String(url).includes("/3187/")
					? fixtureFetch(url)
					: new Response("offline", { status: 503 })) as typeof fetch,
			now,
		),
	);
});
