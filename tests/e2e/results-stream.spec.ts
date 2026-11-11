import { expect, test } from "@playwright/test";
import { simulate } from "../../packages/api/src/worlds/engine";
import {
	type Snapshot,
	scenarioSchema,
	validateSnapshot,
} from "../../packages/api/src/worlds/model";
import seed from "../../packages/api/src/worlds/seed.json" with {
	type: "json",
};

test("SSE reconnects, applies real results and preserves compatible predictions", async ({
	page,
}) => {
	let outgoing: Snapshot = validateSnapshot(seed);
	let connections = 0;
	await page.route("**/rpc/worlds/latest", (route) =>
		route.fulfill({
			json: {
				json: { snapshot: seed, storageAvailable: true, isAdmin: false },
			},
		}),
	);
	await page.route("**/api/stream", (route) => {
		connections++;
		return route.fulfill({
			contentType: "text/event-stream",
			body: `retry: 100\nevent: worlds\nid: ${outgoing.id}\ndata: ${JSON.stringify(outgoing)}\n\n`,
		});
	});
	await page.goto("/");
	await page.getByRole("button", { name: "Fase suíça", exact: true }).click();
	const card = page
		.locator(".match-card")
		.filter({ has: page.locator(".team-choice:enabled") })
		.first();
	await card.locator(".team-choice").first().click();
	await card.getByRole("button", { name: "Confirmar", exact: true }).click();
	const before = await page.evaluate(() =>
		JSON.parse(localStorage.getItem("worlds-2026-draft-v1") ?? "{}"),
	);
	const scenario = scenarioSchema.parse(before.scenario);
	const state = simulate(validateSnapshot(before.snapshot), scenario);
	const pending = state.matches.find(
		(match) => !match.score && match.teams.every(Boolean),
	);
	expect(pending).toBeTruthy();
	if (!pending) throw new Error("Missing pending match");
	outgoing = validateSnapshot({
		...seed,
		id: "automatic-next-version",
		importedAt: "2026-11-11T12:00:00.000Z",
		matches: seed.matches.map((match) =>
			match.id === pending.id
				? {
						...match,
						teams: pending.teams,
						bestOf: pending.bestOf,
						score: [Math.ceil(pending.bestOf / 2), 0],
					}
				: match,
		),
	});
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					JSON.parse(localStorage.getItem("worlds-2026-draft-v1") ?? "{}")
						.snapshot?.id,
			),
		)
		.toBe(outgoing.id);
	const after = await page.evaluate(() =>
		JSON.parse(localStorage.getItem("worlds-2026-draft-v1") ?? "{}"),
	);
	expect(after.scenario.picks).toEqual(before.scenario.picks);
	expect(
		simulate(
			validateSnapshot(after.snapshot),
			scenarioSchema.parse(after.scenario),
		).matches.find((match) => match.id === pending.id)?.origin,
	).toBe("real");
	expect(connections).toBeGreaterThan(1);
	const checkpoint = await page.evaluate(() =>
		localStorage.getItem("worlds-2026-draft-v1"),
	);
	outgoing = validateSnapshot(seed); // A stale replay must not roll back the new result.
	const previousConnections = connections;
	await expect.poll(() => connections).toBeGreaterThan(previousConnections);
	expect(
		await page.evaluate(() => localStorage.getItem("worlds-2026-draft-v1")),
	).toBe(checkpoint);
});

test("SSE keeps beginning-mode drafts untouched and offers the latest base explicitly", async ({
	page,
}) => {
	let outgoing = validateSnapshot(seed);
	await page.route("**/rpc/worlds/latest", (route) =>
		route.fulfill({
			json: {
				json: { snapshot: seed, storageAvailable: true, isAdmin: false },
			},
		}),
	);
	await page.route("**/api/stream", (route) =>
		route.fulfill({
			contentType: "text/event-stream",
			body: `retry: 100\nevent: worlds\ndata: ${JSON.stringify(outgoing)}\n\n`,
		}),
	);
	await page.goto("/");
	await page.getByRole("button", { name: "Do início", exact: true }).click();
	const card = page
		.locator(".match-card")
		.filter({ has: page.locator(".team-choice:enabled") })
		.first();
	await card.locator(".team-choice").first().click();
	await card.getByRole("button", { name: "Confirmar", exact: true }).click();
	const before = await page.evaluate(() =>
		localStorage.getItem("worlds-2026-draft-v1"),
	);
	outgoing = validateSnapshot({
		...seed,
		id: "available-for-beginning",
		importedAt: "2026-11-11T12:00:00.000Z",
	});
	await expect(
		page.getByRole("button", { name: "Aplicar resultados reais" }),
	).toBeVisible();
	expect(
		await page.evaluate(() => localStorage.getItem("worlds-2026-draft-v1")),
	).toBe(before);
	await page.getByRole("button", { name: "Aplicar resultados reais" }).click();
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					JSON.parse(localStorage.getItem("worlds-2026-draft-v1") ?? "{}")
						.snapshot?.id,
			),
		)
		.toBe(outgoing.id);
});
