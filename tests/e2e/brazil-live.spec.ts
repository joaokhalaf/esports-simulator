import { expect, test } from "@playwright/test";

test("VLR cache shows partial, unavailable and forfeit outcomes without changing predictions", async ({
	page,
}) => {
	await page.route("**/rpc/vct/brazil", (route) =>
		route.fulfill({
			json: {
				json: {
					storageAvailable: true,
					snapshot: {
						id: `vlr-br-${"a".repeat(64)}`,
						collectedAt: new Date().toISOString(),
						events: [
							{ id: 3187, count: 3 },
							{ id: 3183, count: 0 },
						],
						matches: [
							{
								id: "vlr-1",
								eventId: 3187,
								url: "https://www.vlr.gg/1/test",
								teams: ["Equipe A", "Equipe B"],
								stage: "Qualifier #2",
								round: "Final",
								status: "live",
								outcome: { kind: "reported-score", score: [1, 0] },
							},
							{
								id: "vlr-2",
								eventId: 3187,
								url: "https://www.vlr.gg/2/test",
								teams: ["Equipe C", "Equipe D"],
								stage: "Qualifier #2",
								round: "Semifinal",
								status: "completed",
								outcome: { kind: "unavailable" },
							},
							{
								id: "vlr-3",
								eventId: 3187,
								url: "https://www.vlr.gg/3/test",
								teams: ["Equipe E", "Equipe F"],
								stage: "Qualifier #2",
								round: "Semifinal",
								status: "completed",
								outcome: { kind: "forfeit", winner: 1 },
							},
						],
					},
				},
			},
		}),
	);
	await page.goto("/simulacoes/brasil");
	await page
		.getByRole("button", { name: "Simular etapa", exact: true })
		.click();
	const before = await page.evaluate(() =>
		localStorage.getItem("vct-brazil-2027-draft-v1"),
	);
	await page
		.getByRole("button", { name: "Partidas · VLR", exact: true })
		.click();
	await expect(
		page.getByText("Em andamento · placar parcial", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByText("Placar não informado", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByText("W.O. · Equipe F", { exact: true }),
	).toBeVisible();
	await expect(
		page.getByText(
			"O VLR ainda não publicou partidas da fase suíça/playoffs.",
			{ exact: true },
		),
	).toBeVisible();
	expect(
		await page.evaluate(() => localStorage.getItem("vct-brazil-2027-draft-v1")),
	).toBe(before);
	await page.setViewportSize({ width: 390, height: 844 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
		390,
	);
});
test("missing or unavailable cache keeps curated data and simulation available", async ({
	page,
}) => {
	await page.route("**/rpc/vct/brazil", (route) =>
		route.fulfill({
			json: { json: { snapshot: null, storageAvailable: false } },
		}),
	);
	await page.goto("/simulacoes/brasil");
	await page
		.getByRole("button", { name: "Partidas · VLR", exact: true })
		.click();
	await expect(
		page.getByText(
			"Coleta indisponível. A base curada e sua simulação continuam disponíveis.",
			{ exact: true },
		),
	).toBeVisible();
	await page
		.getByRole("button", { name: "Resultados das seletivas", exact: true })
		.click();
	await expect(
		page.getByRole("article", {
			name: "Seletiva 2: Master Bank contra 0 intelecto",
		}),
	).toBeVisible();
});
