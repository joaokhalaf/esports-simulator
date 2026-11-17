import assert from "node:assert/strict";
import test from "node:test";
import {
	brazilResults,
	brazilSnapshot,
	newBrazilDraft,
	parseBrazilDraft,
	setBrazilScore,
	simulateBrazil,
	simulateBrazilStage,
} from "../src/vct/brazil";

test("Brazil starts with sixteen confirmed participants and eight Swiss pairings", () => {
	const entrants = [
		...brazilSnapshot.open1,
		...brazilSnapshot.open2,
		...brazilSnapshot.invited,
	];
	assert.equal(entrants.length, 16);
	assert.equal(new Set(entrants).size, 16);
	assert.equal(
		simulateBrazil(newBrazilDraft()).matches.filter(
			(match) => match.stage === "swiss",
		).length,
		8,
	);
	assert.ok(entrants.includes("Master Bank"));
});

test("Brazil preserves real results and never converts forfeits to map scores", () => {
	const before = JSON.stringify(brazilResults);
	const draft = newBrazilDraft();
	assert.equal(setBrazilScore(draft, "open2-seed-2", [0, 2]), draft);
	assert.equal(
		brazilResults.find((match) => match.id === "open2-seed-2")?.outcome.kind,
		"forfeit",
	);
	assert.equal(JSON.stringify(brazilResults), before);
});

test("Brazil can finish Swiss and double elimination; save roundtrips preserve champion", () => {
	for (const random of [() => 0.25, () => 0.75]) {
		const initial = newBrazilDraft();
		const swiss = simulateBrazilStage(initial, "swiss", random);
		const qualified = simulateBrazil(swiss);
		assert.equal(qualified.qualified.length, 8);
		assert.equal(
			qualified.standings.filter((team) => team.wins === 2).length,
			8,
		);
		assert.equal(
			qualified.standings.filter((team) => team.losses === 2).length,
			8,
		);
		const completed = simulateBrazilStage(swiss, "playoffs", random);
		const result = simulateBrazil(completed);
		assert.ok(result.champion && result.runnerUp);
		assert.notEqual(result.champion, result.runnerUp);
		assert.deepEqual(
			parseBrazilDraft(JSON.parse(JSON.stringify(completed))),
			completed,
		);
		assert.deepEqual(initial.picks, {});
		const first = result.matches.find((match) => match.stage === "swiss");
		assert.ok(first);
		const changed = setBrazilScore(completed, first.id, null);
		assert.equal(simulateBrazil(changed).champion, null);
	}
});

test("Brazil rejects corrupt storage and removes foreign or impossible picks", () => {
	assert.equal(parseBrazilDraft(null), null);
	assert.equal(parseBrazilDraft({ version: "old", picks: {} }), null);
	const draft = newBrazilDraft();
	const match = simulateBrazil(draft).matches[0];
	assert.ok(match);
	assert.equal(setBrazilScore(draft, match.id, [3, 0]), draft);
	assert.deepEqual(
		parseBrazilDraft({
			...draft,
			picks: { "na/swiss/fake": { teams: ["a", "b"], score: [2, 0] } },
		}),
		draft,
	);
});
