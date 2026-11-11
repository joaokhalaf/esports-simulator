import assert from "node:assert/strict";
import test from "node:test";
import {
	americasRegionIds,
	americasRegions,
	applyAmericasPublished,
	newAmericasDraft,
	parseAmericasDraft,
	simulateAmericas,
} from "../src/vct/americas";
import type { Score } from "../src/worlds/model";

test("all four regional brackets feed the LATAM final and the three-team LCQ", () => {
	const draft = newAmericasDraft();
	const result = simulateAmericas(draft, (match) => [
		Math.ceil(match.bestOf / 2),
		0,
	]);
	for (const region of americasRegionIds) {
		const { openSpots } = americasRegions[region];
		const { open1, open2, standings, qualified, final } =
			result.regions[region];
		assert.equal(open1.length, openSpots);
		assert.equal(open2.length, openSpots);
		assert.equal(standings.length, openSpots * 4);
		assert.equal(qualified.length, openSpots * 2);
		assert.equal(
			standings.filter(({ losses }) => losses === 2).length,
			openSpots * 2,
		);
		const swiss = result.matches.filter(
			(match) => match.region === region && match.stage === "swiss",
		);
		const pairs = new Set(
			swiss.map((match) => JSON.stringify([...match.teams].sort())),
		);
		assert.equal(pairs.size, swiss.length, "the Swiss cannot have rematches");
		assert.equal(final.bestOf, 5);
		assert.ok(final.winner && final.loser);
	}
	const latam = result.matches.find(
		(match) => match.id === "finals/latam/final",
	);
	assert.deepEqual(latam?.teams, [
		result.regions["latam-north"].final.winner,
		result.regions["latam-south"].final.winner,
	]);
	assert.equal(result.qualifiers.latam, latam?.teams[0]);
	assert.deepEqual(
		new Set(result.lcqStandings.map(({ team }) => team)),
		new Set([
			result.regions.br.final.loser,
			result.regions.na.final.loser,
			latam?.teams[1],
		]),
	);
	assert.ok(Object.values(result.qualifiers).every(Boolean));
	assert.equal(new Set(Object.values(result.qualifiers)).size, 4);
	assert.ok(
		parseAmericasDraft(
			JSON.parse(JSON.stringify({ ...draft, picks: result.picks })),
		),
	);
});

test("changing an open qualifier result invalidates dependent picks while keeping other regions", () => {
	const draft = newAmericasDraft();
	const before = simulateAmericas(draft, (match) => [
		Math.ceil(match.bestOf / 2),
		0,
	]);
	const match = before.matches.find(
		(item) => item.region === "br" && item.stage === "open1",
	);
	assert.ok(match);
	const pick = before.picks[match.id];
	assert.ok(pick);
	const after = simulateAmericas({
		...draft,
		picks: { ...before.picks, [match.id]: { ...pick, score: [0, 2] } },
	});
	assert.notDeepEqual(after.regions.br.open1, before.regions.br.open1);
	assert.equal(after.regions.br.final.winner, null);
	assert.deepEqual(after.regions.na.final, before.regions.na.final);
	assert.equal(after.qualifiers.lcq, null);
	assert.deepEqual(after.picks[match.id]?.score, [0, 2]);
});

test("open byes advance and a three-way LCQ tie requires a scenario decision", () => {
	const draft = newAmericasDraft();
	draft.rosters.br.open1 = draft.rosters.br.open1.slice(0, 5);
	const fill = (match: { id: string; bestOf: number }): Score =>
		match.id === "finals/lcq/group-1"
			? [0, 2]
			: [Math.ceil(match.bestOf / 2), 0];
	const result = simulateAmericas(draft, fill);
	assert.equal(
		result.matches.filter(
			(match) => match.region === "br" && match.stage === "open1",
		).length,
		1,
	);
	assert.equal(result.regions.br.open1.length, 4);
	assert.equal(result.tied.length, 3);
	assert.equal(result.qualifiers.lcq, null);
	const decided = simulateAmericas(
		{ ...draft, picks: result.picks, lcqEliminated: result.tied[0] },
		fill,
	);
	assert.ok(decided.qualifiers.lcq);
	assert.notEqual(decided.qualifiers.lcq, result.tied[0]);
});

test("published qualifiers advance with immutable real scores and preserve unrelated predictions", () => {
	const original = newAmericasDraft();
	const played = simulateAmericas(original, (match) => [
		Math.ceil(match.bestOf / 2),
		0,
	]);
	const before = { ...original, picks: played.picks };
	const updated = applyAmericasPublished(before, "br");
	assert.ok(parseAmericasDraft(JSON.parse(JSON.stringify(updated))));
	const simulated = simulateAmericas(updated, (match) => [
		Math.ceil(match.bestOf / 2),
		0,
	]);
	assert.equal(simulated.regions.br.open1.length, 6);
	assert.equal(simulated.regions.br.open2.length, 4);
	assert.equal(simulated.regions.br.standings.length, 16);
	const real = simulated.matches.filter((match) => match.origin === "real");
	assert.equal(real.length, 5);
	assert.equal(real[0]?.score?.[1], 2);
	for (const match of real) assert.equal(simulated.picks[match.id], undefined);
	for (const [id, pick] of Object.entries(before.picks).filter(([id]) =>
		id.startsWith("na/"),
	))
		assert.deepEqual(updated.picks[id], pick);
	const first = real[0];
	assert.ok(first);
	const forged = {
		...updated,
		picks: {
			...updated.picks,
			[first.id]: {
				teams: first.teams as [string, string],
				score: [2, 0] as Score,
			},
		},
	};
	assert.deepEqual(
		simulateAmericas(forged).matches.find((match) => match.id === real[0]?.id)
			?.score,
		[0, 2],
	);
});

test("published data for all regions completes and rejects changed published rosters", () => {
	const draft = americasRegionIds.reduce(
		(state, region) => applyAmericasPublished(state, region),
		newAmericasDraft(),
	);
	assert.ok(parseAmericasDraft(draft));
	const result = simulateAmericas(draft, (match) => [
		Math.ceil(match.bestOf / 2),
		0,
	]);
	assert.ok(Object.values(result.qualifiers).every(Boolean));
	assert.equal(
		result.matches.filter((match) => match.origin === "real").length,
		13,
	);
	const changed = structuredClone(draft);
	changed.rosters.br.open1[0] = "Inventado";
	assert.equal(parseAmericasDraft(changed), null);
	const stale = { ...draft, snapshotVersion: "2020-01-01" };
	assert.equal(parseAmericasDraft(stale), null);
});
