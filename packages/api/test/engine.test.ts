import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	getDrawTarget,
	redrawRound,
	setPick,
	simulate,
	validateRealProgression,
} from "../src/worlds/engine";
import {
	RULES_VERSION,
	type Scenario,
	type Score,
	scenarioSchema,
	validateSnapshot,
	validScore,
} from "../src/worlds/model";
import { makeSnapshot, normalizeRiot } from "../src/worlds/riot";

const snapshot = validateSnapshot(
	JSON.parse(
		readFileSync(new URL("../src/worlds/seed.json", import.meta.url), "utf8"),
	),
);
const scenario = (
	seed = 1,
	mode: Scenario["mode"] = "beginning",
): Scenario => ({
	name: "Teste",
	seed,
	mode,
	picks: {},
	rulesVersion: RULES_VERSION,
});
function finish(initial: Scenario) {
	let state = initial;
	for (let step = 0; step < 47; step++) {
		const result = simulate(snapshot, state);
		assert.equal(result.blocked, null);
		if (result.champion) return { state, result };
		const match = result.matches.find(
			(m) => !m.score && m.teams.every(Boolean),
		);
		assert.ok(
			match,
			"there must be an actionable match until a champion is found",
		);
		const target = Math.ceil(match.bestOf / 2);
		const score: Score =
			(state.seed + step) % 3 === 0 ? [0, target] : [target, 0];
		state = setPick(snapshot, state, match.id, score);
	}
	throw new Error("Simulation failed to finish");
}

test("MD1, MD3 and MD5 reject ties, unfinished scores and impossible totals", () => {
	for (const bestOf of [1, 3, 5]) {
		const target = Math.ceil(bestOf / 2);
		assert.equal(validScore([target, 0], bestOf), true);
		assert.equal(validScore([target, target], bestOf), false);
		assert.equal(validScore([0, 0], bestOf), false);
		assert.equal(validScore([target + 1, 0], bestOf), false);
	}
});
test("beginning mode starts without real scores and cannot skip dependencies", () => {
	const result = simulate(snapshot, scenario());
	assert.equal(result.matches.length, 6);
	assert.equal(result.matches.filter((m) => m.teams.every(Boolean)).length, 2);
	assert.ok(result.matches.every((m) => m.score === null));
	assert.equal(
		setPick(snapshot, scenario(), snapshot.matches[5]?.id ?? "", [3, 0]).picks
			.constructor,
		Object,
	);
});
test("current mode reproduces all completed API results and locks them", () => {
	const state = scenario(1, "current");
	const result = simulate(snapshot, state);
	const completed = snapshot.matches.filter((m) => m.score);
	assert.equal(
		result.matches.filter((m) => m.origin === "real").length,
		completed.length,
	);
	for (const match of completed)
		assert.deepEqual(
			result.matches.find((m) => m.id === match.id)?.score,
			match.score,
		);
	const first = completed[0];
	assert.ok(first);
	assert.deepEqual(setPick(snapshot, state, first.id, [0, 3]), state);
	assert.equal(result.standings.filter((t) => t.wins === 3).length, 2);
	assert.equal(result.standings.filter((t) => t.losses === 3).length, 2);
});
test("200 draws reach a champion, respect Swiss rules and produce eight qualifiers", () => {
	const frozen = JSON.stringify(snapshot);
	for (let seed = 1; seed <= 200; seed++) {
		const { state, result } = finish(scenario(seed));
		assert.equal(result.matches.length, 46);
		assert.equal(result.standings.filter((t) => t.wins === 3).length, 8);
		assert.equal(result.standings.filter((t) => t.losses === 3).length, 8);
		const history = new Set<string>();
		const records = new Map<string, { wins: number; losses: number }>();
		for (const match of result.matches.filter((m) => m.phase === "swiss")) {
			const [a, b] = match.teams;
			assert.ok(a);
			assert.ok(b);
			assert.ok(match.score);
			const ar = records.get(a) ?? { wins: 0, losses: 0 };
			const br = records.get(b) ?? { wins: 0, losses: 0 };
			assert.deepEqual(ar, br, "opponents must have equal records");
			assert.ok(ar.wins < 3 && ar.losses < 3);
			assert.equal(match.bestOf, ar.wins === 2 || ar.losses === 2 ? 3 : 1);
			const key = [a, b].sort().join(":");
			assert.ok(!history.has(key), "no Swiss rematches");
			history.add(key);
			if (match.score[0] > match.score[1]) {
				ar.wins++;
				br.losses++;
			} else {
				br.wins++;
				ar.losses++;
			}
			records.set(a, ar);
			records.set(b, br);
			if (match.round === "Rodada 1")
				assert.notEqual(
					snapshot.teams.find((t) => t.id === a)?.region,
					snapshot.teams.find((t) => t.id === b)?.region,
				);
		}
		for (const match of result.matches.filter((m) => m.phase === "quarter")) {
			const a = result.standings.find((t) => t.teamId === match.teams[0]);
			const b = result.standings.find((t) => t.teamId === match.teams[1]);
			assert.ok(a);
			assert.ok(b);
			if (a.losses === 0) assert.equal(b.losses, 2);
			if (b.losses === 0) assert.equal(a.losses, 2);
		}
		assert.deepEqual(
			simulate(snapshot, state),
			result,
			"same seed and choices must replay exactly",
		);
	}
	assert.equal(
		JSON.stringify(snapshot),
		frozen,
		"simulation cannot mutate real data",
	);
});
test("changing an opening preserves its parallel match and removes later rounds", () => {
	const { state } = finish(scenario(42));
	const first = snapshot.matches[0];
	assert.ok(first);
	const changed = setPick(snapshot, state, first.id, [0, 3]);
	assert.equal(Object.keys(changed.picks).length, 2);
	const parallel = snapshot.matches[1];
	assert.ok(parallel);
	assert.deepEqual(changed.picks[parallel.id], state.picks[parallel.id]);
	assert.equal(simulate(snapshot, changed).champion, null);
});
test("a single round 4 result immediately updates both teams before the next draw", () => {
	const state = scenario(1, "current");
	const cfo = snapshot.teams.find((team) => team.code === "CFO");
	const kc = snapshot.teams.find((team) => team.code === "KC");
	assert.ok(cfo && kc);
	const match = simulate(snapshot, state).matches.find(
		(match) => match.round === "Rodada 4" && match.teams.includes(cfo.id),
	);
	assert.ok(match);
	const updated = setPick(
		snapshot,
		state,
		match.id,
		match.teams[0] === cfo.id ? [2, 0] : [0, 2],
	);
	const result = simulate(snapshot, updated);
	assert.deepEqual(
		result.standings.find((standing) => standing.teamId === cfo.id),
		{ teamId: cfo.id, wins: 2, losses: 2 },
	);
	assert.deepEqual(
		result.standings.find((standing) => standing.teamId === kc.id),
		{ teamId: kc.id, wins: 1, losses: 3 },
	);
	assert.equal(
		result.matches.filter((match) => match.round === "Rodada 5").length,
		0,
		"the next draw still waits for the other results",
	);
});

test("round 4 accepts three picks in any confirmation order", () => {
	const pending = simulate(snapshot, scenario(1, "current"))
		.matches.filter(
			(match) => match.phase === "swiss" && match.round === "Rodada 4",
		)
		.slice(0, 3);
	assert.equal(pending.length, 3);
	for (const order of [
		[0, 1, 2],
		[0, 2, 1],
		[1, 0, 2],
		[1, 2, 0],
		[2, 0, 1],
		[2, 1, 0],
	]) {
		let state = scenario(1, "current");
		for (const index of order) {
			const match = pending[index];
			assert.ok(match);
			state = setPick(snapshot, state, match.id, index % 2 ? [0, 2] : [2, 1]);
		}
		assert.equal(
			Object.keys(state.picks).length,
			3,
			`confirmation order ${order}`,
		);
		for (const [index, match] of pending.entries()) {
			assert.deepEqual(
				state.picks[match.id]?.score,
				index % 2 ? [0, 2] : [2, 1],
			);
		}
	}
});

test("editing or clearing round 4 preserves its other picks and invalidates later rounds", () => {
	const { state, result } = finish(scenario(18, "current"));
	const round = result.matches.filter(
		(match) => match.phase === "swiss" && match.round === "Rodada 4",
	);
	const first = round[0];
	assert.ok(first);
	for (const score of [[2, 1] as Score, null]) {
		const changed = setPick(snapshot, state, first.id, score);
		assert.equal(Object.keys(changed.picks).length, score ? 6 : 5);
		for (const match of round.slice(1))
			assert.deepEqual(changed.picks[match.id], state.picks[match.id]);
		assert.equal(changed.picks[first.id]?.score ?? null, score);
		assert.equal(simulate(snapshot, changed).champion, null);
	}
});

test("current scenario can finish and remains tied to the original snapshot", () => {
	const { state, result } = finish(scenario(18, "current"));
	assert.ok(result.champion);
	const next = makeSnapshot({
		source: "admin",
		tournamentId: snapshot.tournamentId,
		teams: snapshot.teams,
		matches: snapshot.matches,
	});
	assert.notEqual(next.id, snapshot.id);
	assert.equal(
		JSON.stringify(simulate(snapshot, state)),
		JSON.stringify(result),
	);
});
test("snapshots reject duplicates, missing coverage and invalid results", () => {
	const duplicated = structuredClone(snapshot);
	duplicated.matches[1] = duplicated
		.matches[0] as (typeof duplicated.matches)[number];
	assert.throws(() => validateSnapshot(duplicated));
	assert.throws(() =>
		validateSnapshot({ ...snapshot, matches: snapshot.matches.slice(1) }),
	);
	const invalid = structuredClone(snapshot);
	const first = invalid.matches[0];
	assert.ok(first);
	first.score = [3, 3];
	assert.throws(() => validateSnapshot(invalid));
	const inconsistent = structuredClone(snapshot);
	const opening = inconsistent.matches[0];
	assert.ok(opening);
	opening.score = [0, 3];
	assert.throws(() => validateRealProgression(inconsistent));
	assert.throws(() =>
		normalizeRiot({
			data: { esports: { events: [], pages: { older: "next", newer: null } } },
		}),
	);
});

test("round redraw changes opponents, preserves completed rounds and rejects real results", () => {
	const state = scenario(1, "current");
	const original = simulate(snapshot, state);
	assert.equal(getDrawTarget(original, "swiss")?.key, "swiss-4");
	assert.equal(redrawRound(snapshot, state, "swiss-1", 11), state);
	const previous = original.matches.filter(
		(match) => match.phase === "swiss" && match.round !== "Rodada 4",
	);
	const records = new Map(
		original.standings.map((standing) => [standing.teamId, standing]),
	);
	const history = new Set(
		previous.map((match) => [...match.teams].sort().join(":")),
	);
	const signature = (matches: typeof original.matches) =>
		matches
			.map((match) => [...match.teams].sort().join(":"))
			.sort()
			.join("|");
	const oldRound = original.matches.filter(
		(match) => match.round === "Rodada 4",
	);
	for (let seed = 1; seed <= 30; seed++) {
		const updated = redrawRound(snapshot, state, "swiss-4", seed);
		assert.notEqual(updated, state);
		const result = simulate(snapshot, updated);
		assert.equal(result.blocked, null);
		assert.deepEqual(
			result.matches.filter(
				(match) => match.phase === "swiss" && match.round !== "Rodada 4",
			),
			previous,
		);
		const drawn = result.matches.filter((match) => match.round === "Rodada 4");
		assert.notEqual(signature(drawn), signature(oldRound));
		assert.equal(new Set(drawn.flatMap((match) => match.teams)).size, 12);
		for (const match of drawn) {
			assert.equal(match.draw, "simulated");
			assert.equal(history.has([...match.teams].sort().join(":")), false);
			const a = records.get(match.teams[0] ?? "");
			const b = records.get(match.teams[1] ?? "");
			assert.equal(a?.wins, b?.wins);
			assert.equal(a?.losses, b?.losses);
		}
		assert.deepEqual(
			simulate(
				snapshot,
				scenarioSchema.parse(JSON.parse(JSON.stringify(updated))),
			),
			result,
		);
	}
});

test("redrawing a later round preserves earlier picks and draw seeds", () => {
	const earlierDraw = redrawRound(
		snapshot,
		scenario(18, "current"),
		"swiss-4",
		91,
	);
	const { state } = finish(earlierDraw);
	const updated = redrawRound(snapshot, state, "quarter", 123);
	assert.notEqual(updated, state);
	const result = simulate(snapshot, updated);
	assert.equal(result.blocked, null);
	assert.equal(updated.drawSeeds?.["swiss-4"], state.drawSeeds?.["swiss-4"]);
	assert.equal(Object.keys(updated.picks).length, 9);
	assert.equal(
		result.matches.filter((match) => match.phase === "quarter" && match.score)
			.length,
		0,
	);
	assert.equal(result.champion, null);
	for (const [id, pick] of Object.entries(updated.picks))
		assert.deepEqual(pick, state.picks[id]);
	const redrawnSwiss = redrawRound(snapshot, state, "swiss-4", 456);
	assert.equal(Object.keys(redrawnSwiss.picks).length, 0);
	assert.equal(redrawnSwiss.drawSeeds?.quarter, undefined);
	assert.equal(
		simulate(snapshot, redrawnSwiss).matches.filter(
			(match) => match.origin === "real",
		).length,
		30,
	);
});

test("first-round redraw keeps Play-In and respects initial pots and regions", () => {
	const { state } = finish(scenario(42));
	const updated = redrawRound(snapshot, state, "swiss-1", 78);
	assert.notEqual(updated, state);
	assert.equal(Object.keys(updated.picks).length, 6);
	const result = simulate(snapshot, updated);
	assert.equal(result.blocked, null);
	for (const match of result.matches.filter(
		(match) => match.round === "Rodada 1",
	)) {
		const [a, b] = match.teams.map((id) =>
			snapshot.teams.find((team) => team.id === id),
		);
		assert.ok(a && b);
		assert.notEqual(a.region, b.region);
		assert.equal(match.draw, "simulated");
	}
});
