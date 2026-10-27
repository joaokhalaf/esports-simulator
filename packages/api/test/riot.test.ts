import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateSnapshot } from "../src/worlds/model";
import { importWorlds, normalizeRiot } from "../src/worlds/riot";

const snapshot = validateSnapshot(
	JSON.parse(
		readFileSync(new URL("../src/worlds/seed.json", import.meta.url), "utf8"),
	),
);
const phases = {
	playin: "Fase de Entrada",
	swiss: "Fase Suíça",
	quarter: "Quartas de Final",
	semi: "Semifinais",
	final: "Finais",
};
const payload = {
	data: {
		esports: {
			pages: { older: null, newer: null },
			events: snapshot.matches.map((match) => ({
				id: match.id,
				startTime: match.startTime,
				blockName: phases[match.phase],
				state: match.score ? "completed" : "unstarted",
				tournament: { id: snapshot.tournamentId },
				match: { strategy: { type: "bestOf", count: match.bestOf } },
				matchTeams: match.teams.map((id, index) => {
					const team = snapshot.teams.find((t) => t.id === id);
					return {
						teamId: id ?? "0",
						name: team?.name ?? "TBD",
						code: team?.code ?? "TBD",
						image: team?.image ?? null,
						homeLeague: { regionSlug: team?.region ?? null },
						result: match.score
							? {
									gameWins: match.score[index],
									outcome:
										match.score[index] === Math.ceil(match.bestOf / 2)
											? "win"
											: "loss",
								}
							: null,
					};
				}),
			})),
		},
	},
};

test("normalizer preserves completed results and excludes TBD from participants", () => {
	const normalized = normalizeRiot(payload);
	assert.deepEqual(normalized.teams, snapshot.teams);
	assert.deepEqual(normalized.matches, snapshot.matches);
	assert.equal(normalized.id, snapshot.id);
	const paginated = structuredClone(payload);
	paginated.data.esports.pages = {
		older: "more" as unknown as null,
		newer: null,
	};
	assert.throws(() => normalizeRiot(paginated));
	const otherEdition = structuredClone(payload);
	const event = otherEdition.data.esports.events[0];
	assert.ok(event);
	event.tournament.id = "other";
	assert.throws(() => normalizeRiot(otherEdition));
});
test("import recovers from a changed operation manifest, deduplicates requests and caches without tokens", async () => {
	const original = globalThis.fetch;
	let queries = 0;
	let requests = 0;
	const newHash = "b".repeat(64);
	globalThis.fetch = async (input, init) => {
		requests++;
		const url = new URL(String(input));
		assert.equal(url.hostname, "lolesports.com");
		assert.equal(new Headers(init?.headers).has("authorization"), false);
		if (url.pathname === "/api/gql") {
			queries++;
			assert.equal(
				new Headers(init?.headers).get("content-type"),
				"application/json",
			);
			if (queries === 1)
				return Response.json({
					errors: [{ extensions: { code: "PERSISTED_QUERY_NOT_IN_LIST" } }],
				});
			assert.equal(
				JSON.parse(url.searchParams.get("extensions") ?? "{}").persistedQuery
					.sha256Hash,
				newHash,
			);
			return Response.json(payload);
		}
		if (url.pathname === "/pt-BR/")
			return new Response(
				'<script src="/_next/static/chunks/app.js"></script>',
			);
		if (url.pathname.endsWith("app.js"))
			return new Response('Promise.all(["static/chunks/manifest.js"])');
		if (url.pathname.endsWith("manifest.js"))
			return new Response(
				`apollo-persisted-query-manifest {"id":"${newHash}","name":"homeEvents"}`,
			);
		throw new Error("Unexpected upstream request");
	};
	try {
		const [a, b] = await Promise.all([importWorlds(), importWorlds()]);
		assert.deepEqual(a, b);
		assert.equal(a.id, snapshot.id);
		assert.equal(queries, 2);
		const before = requests;
		assert.deepEqual(await importWorlds(), a);
		assert.equal(requests, before);
	} finally {
		globalThis.fetch = original;
	}
});
