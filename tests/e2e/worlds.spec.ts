import { expect, type Page, test } from "@playwright/test";
import seed from "../../packages/api/src/worlds/seed.json" with {
	type: "json",
};

async function pickFirstReady(page: Page, side: 0 | 1 = 0) {
	const card = page
		.locator(".match-card")
		.filter({ has: page.locator(".team-choice:enabled") })
		.first();
	await card.locator(".team-choice").nth(side).click();
	await card.getByRole("button", { name: "Confirmar", exact: true }).click();
}
async function swiss(page: Page) {
	await page.getByRole("button", { name: "Fase suíça", exact: true }).click();
}

test("visitor selects scores, restores a draft and restarts from the beginning", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Worlds 2026", exact: true }),
	).toBeVisible();
	await swiss(page);
	await pickFirstReady(page);
	await expect(page.locator(".is-simulated")).toHaveCount(1);
	await page.reload();
	await swiss(page);
	await expect(page.locator(".is-simulated")).toHaveCount(1);
	page.once("dialog", (dialog) => dialog.accept());
	await page
		.locator(".simulation-controls")
		.getByRole("button", { name: "Do início", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { name: "Fase de entrada", exact: true }),
	).toBeVisible();
	await expect(page.locator(".is-simulated")).toHaveCount(0);
	await expect(page.locator(".team-choice:enabled")).toHaveCount(4);
	expect(errors).toEqual([]);
});

test("simulation stays in this browser without login or server saves", async ({
	page,
	browser,
}) => {
	const requests: string[] = [];
	page.on("request", (request) => requests.push(request.url()));
	await page.goto("/");
	await swiss(page);
	await pickFirstReady(page);
	const picked = await page.locator(".is-simulated").getAttribute("aria-label");
	await page.reload();
	await swiss(page);
	await expect(page.locator(".is-simulated")).toHaveAttribute(
		"aria-label",
		picked ?? "",
	);
	await expect(page.getByRole("textbox", { name: "SEU CENÁRIO" })).toHaveCount(
		0,
	);
	await expect(
		page.getByText(
			/Entrar para salvar|Salvar cenário|Meus cenários|Visitante|Criar conta/,
		),
	).toHaveCount(0);
	const other = await browser.newContext();
	const otherPage = await other.newPage();
	await otherPage.goto("/");
	await swiss(otherPage);
	await expect(otherPage.locator(".is-simulated")).toHaveCount(0);
	await other.close();
	for (const route of ["/login", "/dashboard"]) {
		await page.goto(route);
		await expect(page).toHaveURL(/:\d+\/$/);
		await expect(
			page.getByRole("heading", { name: "Worlds 2026", exact: true }),
		).toBeVisible();
	}
	expect(
		requests.filter((url) =>
			/\/api\/auth|worlds[/.](save|mine|shared|publish)/.test(url),
		),
	).toEqual([]);
});

test("reference layout supports connected playoffs, inline score editing and undo", async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.goto("/");
	await expect(
		page.locator(".championship-sidebar .sidebar-header"),
	).toBeVisible();
	await expect(page.getByText("PT-BR", { exact: true })).toHaveCount(0);
	await expect(page.locator(".app-header")).toHaveCount(0);
	await expect
		.poll(async () =>
			page.locator(".simulation-actions").evaluate((actions) => {
				const count = actions
					.querySelector(".scenario-count")
					?.getBoundingClientRect();
				const button = actions
					.querySelector(".outline-button")
					?.getBoundingClientRect();
				return count && button
					? Math.abs(
							count.top + count.height / 2 - button.top - button.height / 2,
						)
					: 100;
			}),
		)
		.toBeLessThanOrEqual(1);

	await page
		.getByRole("button", { name: "Simular fases anteriores", exact: true })
		.click();
	await expect(page.locator(".stage-quarter .team-choice:enabled")).toHaveCount(
		8,
	);
	const quarter = page.locator(".stage-quarter .match-card");
	for (let i = 0; i < 3; i++) {
		const card = quarter.nth(i);
		await card.locator(".team-choice").first().click();
		await card.getByRole("button", { name: "3 - 1", exact: true }).click();
		await card.getByRole("button", { name: "Confirmar", exact: true }).click();
	}
	await quarter.nth(3).locator(".team-choice").nth(1).click();
	await quarter
		.nth(3)
		.getByRole("button", { name: "3 - 1", exact: true })
		.click();
	await expect(page.locator(".bracket-connectors")).toHaveCount(2);
	await page.setViewportSize({ width: 1280, height: 720 });
	await page.screenshot({
		path: testInfo.outputPath("notebook-small.png"),
		fullPage: false,
	});
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.screenshot({
		path: testInfo.outputPath("desktop.png"),
		fullPage: true,
	});
	await page.setViewportSize({ width: 1920, height: 1080 });
	await page.screenshot({
		path: testInfo.outputPath("monitor.png"),
		fullPage: false,
	});
	await page.setViewportSize({ width: 1366, height: 768 });
	await quarter
		.nth(3)
		.getByRole("button", { name: "Confirmar", exact: true })
		.click();
	await expect(page.locator(".stage-semi .team-choice:enabled")).toHaveCount(4);
	await page.getByRole("button", { name: "Desfazer última alteração" }).click();
	await expect(page.locator(".stage-quarter .is-simulated")).toHaveCount(3);
	await page
		.getByRole("button", { name: "Simular restantes", exact: true })
		.click();
	await expect(page.locator(".champion-heading")).not.toContainText(
		"A definir",
	);
	await expect(page.locator(".stage-final .match-score")).not.toHaveText([
		"-",
		"-",
	]);
});

test("mobile contains the bracket scroll and the championship catalog works", async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Worlds 2026", exact: true }),
	).toBeVisible();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
	await expect(page.locator(".bracket-board.is-focused")).toBeVisible();
	await expect(page.locator(".bracket-stage")).toHaveCount(1);
	await page
		.getByRole("tablist", { name: "Rodadas dos playoffs" })
		.getByRole("tab", { name: "Chave completa", exact: true })
		.click();
	expect(
		await page
			.locator(".bracket-scroll")
			.evaluate((element) => element.scrollWidth > element.clientWidth),
	).toBe(true);
	await page.screenshot({
		path: testInfo.outputPath("mobile.png"),
		fullPage: true,
	});
	await expect(
		page.getByRole("textbox", { name: "Buscar campeonato" }),
	).toHaveCount(0);
	await expect(page.locator(".championship-item")).toHaveCount(7);
	await page.getByRole("tab", { name: "Valorant", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Valorant chega depois" }),
	).toBeVisible();
	await page.goto("/?scenario=00000000-0000-4000-8000-000000000000");
	await expect(
		page.getByRole("heading", { name: "Worlds 2026", exact: true }),
	).toBeVisible();
});

test("round tabs preserve choices and show both Play-In brackets when they fit", async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	await page.goto("/");
	await swiss(page);
	const tabs = page.getByRole("tablist", { name: "Rodadas do suíço" });
	await expect(
		tabs.getByRole("tab", { name: "Todas as rodadas", exact: true }),
	).toHaveAttribute("aria-selected", "true");
	await expect(page.locator(".round-column")).toHaveCount(5);
	await page.evaluate(() => window.scrollTo({ top: 300, behavior: "instant" }));
	await expect
		.poll(async () =>
			page.locator(".championship-sidebar").evaluate((sidebar) => {
				const bounds = sidebar.getBoundingClientRect();
				return bounds.top <= 1 && bounds.bottom >= innerHeight - 1;
			}),
		)
		.toBe(true);
	await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));

	await expect(page.locator(".swiss-board .match-card")).toHaveCount(33);
	const columns = page.locator(".swiss-board .round-column");
	const campaigns = [
		["0-0"],
		["1-0", "0-1"],
		["2-0", "1-1", "0-2"],
		["2-1", "1-2"],
		["2-2"],
	];
	for (const [round, records] of campaigns.entries()) {
		for (const record of records) {
			const pool = columns.nth(round).locator(`[data-record="${record}"]`);
			await expect(pool).toBeVisible();
			const [wins, losses] = record.split("-").map(Number);
			await expect(pool.locator(".record-win")).toHaveCount(wins);
			await expect(pool.locator(".record-loss")).toHaveCount(losses);
			await expect(pool.locator(".swiss-record-squares > span")).toHaveCount(4);
		}
	}
	// Check each imported matchup against its campaign from preceding rounds.
	const standings = new Map<string, { wins: number; losses: number }>();
	const swissMatches = seed.matches.filter((match) => match.phase === "swiss");
	let offset = 0;
	for (const [round, count] of [8, 8, 8, 6, 3].entries()) {
		const matches = swissMatches.slice(offset, offset + count);
		for (const match of matches) {
			if (!match.teams.every(Boolean)) continue;
			const campaign = standings.get(match.teams[0] as string) ?? {
				wins: 0,
				losses: 0,
			};
			const codes = match.teams.map(
				(id) => seed.teams.find((team) => team.id === id)?.code,
			);
			await expect(
				columns
					.nth(round)
					.locator(`[data-record="${campaign.wins}-${campaign.losses}"]`)
					.getByRole("article", {
						name: `Confronto ${codes[0]} contra ${codes[1]}`,
						exact: true,
					}),
			).toHaveCount(1);
		}
		for (const match of matches) {
			for (const [side, id] of match.teams.entries()) {
				if (!id) continue;
				const record = standings.get(id) ?? { wins: 0, losses: 0 };
				if (match.score) {
					if (match.score[side] === Math.max(...match.score)) record.wins++;
					else record.losses++;
				}
				standings.set(id, record);
			}
		}
		offset += count;
		if (matches.some((match) => !match.score)) break;
	}

	await page.screenshot({
		path: testInfo.outputPath("swiss-wide.png"),
		fullPage: true,
	});
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(tabs.getByRole("tab", { name: /^Rodada 4/ })).toHaveAttribute(
		"aria-selected",
		"true",
	);
	await expect(page.locator(".selected-round .match-card")).toHaveCount(6);
	await page.setViewportSize({ width: 1920, height: 1080 });
	await expect(
		tabs.getByRole("tab", { name: "Todas as rodadas", exact: true }),
	).toHaveAttribute("aria-selected", "true");
	await tabs.getByRole("tab", { name: /^Rodada 4/ }).click();
	await expect(page.locator(".selected-round .match-card")).toHaveCount(6);
	await pickFirstReady(page);
	await tabs
		.getByRole("tab", { name: "Todas as rodadas", exact: true })
		.click();
	await expect(page.locator(".swiss-board .is-simulated")).toHaveCount(1);
	await tabs.getByRole("tab", { name: /^Rodada 4/ }).click();
	await tabs.getByRole("tab", { name: /^Rodada 4/ }).press("ArrowLeft");
	await expect(tabs.getByRole("tab", { name: /^Rodada 3/ })).toHaveAttribute(
		"aria-selected",
		"true",
	);
	await page
		.getByRole("button", { name: "Fase de entrada", exact: true })
		.click();
	const playin = page.getByRole("tablist", { name: "Rodadas do Play-In" });
	await expect(page.locator(".playin-slot")).toHaveCount(6);
	await expect(page.locator(".playin-connectors path")).toHaveCount(8);
	await page.screenshot({
		path: testInfo.outputPath("playin-wide.png"),
		fullPage: false,
	});
	await playin.getByRole("tab", { name: /^Final do Play-In/ }).click();
	await expect(page.locator(".selected-round .match-card")).toHaveCount(1);
	await playin.getByRole("tab", { name: /^Final do Play-In/ }).press("Home");
	await expect(
		playin.getByRole("tab", { name: "Chave completa", exact: true }),
	).toHaveAttribute("aria-selected", "true");
	await page.setViewportSize({ width: 390, height: 844 });
	await page.reload();
	await swiss(page);
	const mobileTabs = page.getByRole("tablist", { name: "Rodadas do suíço" });
	await expect(
		mobileTabs.getByRole("tab", { name: /^Rodada 4/ }),
	).toHaveAttribute("aria-selected", "true");
	await expect(page.locator(".selected-round .match-card")).toHaveCount(6);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
});

test("three open round 4 editors retain every confirmation in reverse order", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.goto("/");
	await swiss(page);
	await page
		.getByRole("tablist", { name: "Rodadas do suíço" })
		.getByRole("tab", { name: /^Rodada 4/ })
		.click();
	const cards = page.locator(
		'.selected-round .swiss-pool[data-record="2-1"] .match-card',
	);
	await expect(cards).toHaveCount(3);
	for (let index = 0; index < 3; index++) {
		await cards
			.nth(index)
			.locator(".team-choice")
			.nth(index % 2)
			.click();
		await cards
			.nth(index)
			.getByRole("button", { name: index % 2 ? "2 - 0" : "2 - 1", exact: true })
			.click();
	}
	await expect(
		cards.filter({
			has: page.getByRole("button", { name: "Confirmar", exact: true }),
		}),
	).toHaveCount(3);
	for (const index of [2, 1, 0]) {
		await cards
			.nth(index)
			.getByRole("button", { name: "Confirmar", exact: true })
			.click();
	}
	await expect(page.locator(".is-simulated")).toHaveCount(3);
	for (let index = 0; index < 3; index++) {
		await expect(cards.nth(index).locator(".match-score")).toHaveText(
			index % 2 ? ["0", "2"] : ["2", "1"],
		);
	}
	await page.reload();
	await swiss(page);
	await page
		.getByRole("tablist", { name: "Rodadas do suíço" })
		.getByRole("tab", { name: /^Rodada 4/ })
		.click();
	await expect(page.locator(".is-simulated")).toHaveCount(3);
});

test("reset uses a confirmation toast with cancel, approval and undo", async ({
	page,
}, testInfo) => {
	const dialogs: string[] = [];
	page.on("dialog", async (dialog) => {
		dialogs.push(dialog.message());
		await dialog.dismiss();
	});
	await page.goto("/");
	await swiss(page);
	await pickFirstReady(page);
	const reset = page
		.locator(".simulation-controls")
		.getByRole("button", { name: "Reiniciar", exact: true });
	const toast = page.locator("[data-sonner-toast].reset-confirmation");
	await reset.click();
	await expect(toast).toContainText("Reiniciar simulação?");
	await expect(page.locator(".is-simulated")).toHaveCount(1);
	await toast.getByRole("button", { name: "Cancelar", exact: true }).click();
	await expect(toast).toHaveCount(0);
	await expect(page.locator(".is-simulated")).toHaveCount(1);
	await reset.click();
	await reset.click();
	await expect(toast).toHaveCount(1);
	await toast
		.getByRole("button", { name: "Cancelar", exact: true })
		.click({ trial: true });
	await page.screenshot({
		path: testInfo.outputPath("reset-confirmation.png"),
		fullPage: false,
	});
	// Editing another match while the toast is open must not make Undo restore stale data.
	const next = page
		.locator(".match-card:not(.is-simulated)")
		.filter({ has: page.locator(".team-choice:enabled") })
		.first();
	await next.locator(".team-choice").first().click();
	await next.getByRole("button", { name: "Confirmar", exact: true }).click();
	await expect(page.locator(".is-simulated")).toHaveCount(2);
	await toast.getByRole("button", { name: "Reiniciar", exact: true }).click();
	await expect(page.locator(".is-simulated")).toHaveCount(0);
	await expect(reset).toBeDisabled();
	await page.getByRole("button", { name: "Desfazer última alteração" }).click();
	await expect(page.locator(".is-simulated")).toHaveCount(2);
	await page.reload();
	await swiss(page);
	await expect(page.locator(".is-simulated")).toHaveCount(2);
	expect(dialogs).toEqual([]);
});

test("round tabs advance after the final pick and Swiss leads into playoffs", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.goto("/");
	await swiss(page);
	const swissTabs = page.getByRole("tablist", { name: "Rodadas do suíço" });
	await swissTabs.getByRole("tab", { name: /^Rodada 4/ }).click();
	async function confirmPending(count: number) {
		for (let index = 0; index < count; index++) {
			const card = page
				.locator(".match-card:not(.is-simulated)")
				.filter({ has: page.locator(".team-choice:enabled") })
				.first();
			await card.locator(".team-choice").first().click();
			await card
				.getByRole("button", { name: "Confirmar", exact: true })
				.click();
		}
	}
	await confirmPending(5);
	await expect(
		swissTabs.getByRole("tab", { name: /^Rodada 4/ }),
	).toHaveAttribute("aria-selected", "true");
	await swissTabs
		.getByRole("tab", { name: "Todas as rodadas", exact: true })
		.click();
	await confirmPending(1);
	await expect(
		swissTabs.getByRole("tab", { name: /^Rodada 5/ }),
	).toHaveAttribute("aria-selected", "true");
	await expect(page.locator(".selected-round .match-card")).toHaveCount(3);
	await page.getByRole("button", { name: "Desfazer última alteração" }).click();
	await expect(
		swissTabs.getByRole("tab", { name: /^Rodada 4/ }),
	).toHaveAttribute("aria-selected", "true");
	await confirmPending(1);
	await expect(
		swissTabs.getByRole("tab", { name: /^Rodada 5/ }),
	).toHaveAttribute("aria-selected", "true");
	await confirmPending(3);
	await expect(
		page.getByRole("button", { name: "Playoffs", exact: true }),
	).toHaveAttribute("aria-current", "page");
	const playoffs = page.getByRole("tablist", { name: "Rodadas dos playoffs" });
	await playoffs.getByRole("tab", { name: /^Quartas de final/ }).click();
	await confirmPending(4);
	await expect(
		playoffs.getByRole("tab", { name: /^Semifinais/ }),
	).toHaveAttribute("aria-selected", "true");
	await confirmPending(2);
	await expect(
		playoffs.getByRole("tab", { name: /^Grande final/ }),
	).toHaveAttribute("aria-selected", "true");
	await confirmPending(1);
	await expect(page.locator(".champion-heading")).not.toContainText(
		"A definir",
	);
});

test("CFO advances immediately into round 5 while the other round 4 matches remain open", async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	await page.goto("/");
	await swiss(page);
	const tabs = page.getByRole("tablist", { name: "Rodadas do suíço" });
	await tabs
		.getByRole("tab", { name: "Todas as rodadas", exact: true })
		.click();
	const cfo = page.getByRole("article", {
		name: "Confronto CFO contra KC",
		exact: true,
	});
	const round5 = page.locator(".swiss-board .round-column").nth(4);
	await expect(round5.locator(".swiss-advancing-team")).toHaveCount(0);
	await cfo.getByRole("button", { name: "Escolher CFO", exact: true }).click();
	await cfo.getByRole("button", { name: "2 - 0", exact: true }).click();
	await cfo.getByRole("button", { name: "Confirmar", exact: true }).click();
	await expect(round5.locator(".swiss-advancing-team")).toHaveCount(1);
	await expect(round5.locator(".swiss-advancing-team")).toContainText("CFO");
	await expect(round5).toContainText("Adversário a definir");
	await expect(round5.locator(".team-choice:enabled")).toHaveCount(0);
	await expect(page.locator(".is-simulated")).toHaveCount(1);
	await page.screenshot({
		path: testInfo.outputPath("cfo-round5-immediate.png"),
		fullPage: true,
	});
	await cfo.getByRole("button", { name: "Escolher KC", exact: true }).click();
	await cfo.getByRole("button", { name: "Confirmar", exact: true }).click();
	await expect(round5.locator(".swiss-advancing-team")).toContainText("KC");
	await expect(round5.locator(".swiss-advancing-team")).not.toContainText(
		"CFO",
	);
	await page.getByRole("button", { name: "Desfazer última alteração" }).click();
	await expect(round5.locator(".swiss-advancing-team")).toContainText("CFO");
	await page.reload();
	await swiss(page);
	await tabs
		.getByRole("tab", { name: "Todas as rodadas", exact: true })
		.click();
	await expect(round5.locator(".swiss-advancing-team")).toContainText("CFO");
});

test("visible redraw changes the current round, supports cancel and undo, and persists locally", async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	await page.goto("/");
	await swiss(page);
	const tabs = page.getByRole("tablist", { name: "Rodadas do suíço" });
	await tabs.getByRole("tab", { name: /^Rodada 4/ }).click();
	const redraw = page.locator(".simulation-controls .draw-button");
	await expect(redraw).toBeVisible();
	await expect(redraw).toContainText("Rodada 4");
	const pairings = () =>
		page
			.locator(".selected-round .match-card")
			.evaluateAll((cards) =>
				cards.map((card) => card.getAttribute("aria-label")),
			);
	const original = await pairings();
	await redraw.click();
	await expect.poll(pairings).not.toEqual(original);
	await expect(page.locator(".is-simulated")).toHaveCount(0);
	await page.getByRole("button", { name: "Desfazer última alteração" }).click();
	await expect.poll(pairings).toEqual(original);
	await pickFirstReady(page);
	await redraw.click();
	const confirmation = page.locator(
		'[data-sonner-toast].reset-confirmation:not([data-removed="true"])',
	);
	await expect(confirmation).toContainText("Refazer sorteio: Rodada 4?");
	await confirmation
		.getByRole("button", { name: "Cancelar", exact: true })
		.click();
	await expect(page.locator(".is-simulated")).toHaveCount(1);
	await expect.poll(pairings).toEqual(original);
	await redraw.click();
	await confirmation
		.getByRole("button", { name: "Sortear", exact: true })
		.click();
	await expect.poll(pairings).not.toEqual(original);
	await expect(page.locator(".is-simulated")).toHaveCount(0);
	const newPairs = await pairings();
	await page.screenshot({
		path: testInfo.outputPath("redraw-wide.png"),
		fullPage: false,
	});
	await page.reload();
	await swiss(page);
	await tabs.getByRole("tab", { name: /^Rodada 4/ }).click();
	await expect.poll(pairings).toEqual(newPairs);
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(redraw).toBeVisible();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
});
