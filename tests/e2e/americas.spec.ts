import { expect, test } from "@playwright/test";

test("Valorant qualifiers are reachable from the calendar and the four spots persist", async ({
	page,
}) => {
	await page.addInitScript(() => {
		Math.random = () => 0.25;
	});
	await page.goto("/calendario?game=valorant");
	await page
		.getByRole("link", { name: "Simular classificatórias das Américas" })
		.click();
	await expect(
		page.getByRole("heading", { name: "Classificatórias VCT Americas 2027" }),
	).toBeVisible();

	const regions = page.getByRole("navigation", {
		name: "Regiões da classificatória",
	});
	const stages = page.getByRole("navigation", { name: "Fases da região" });
	const fill = page.getByRole("button", { name: "Simular etapa" });
	const slots = page.getByRole("region", { name: "Vagas no Kickoff" });
	for (const region of [
		"Brasil",
		"América do Norte",
		"LATAM Norte",
		"LATAM Sul",
	]) {
		await regions.getByRole("button", { name: region, exact: true }).click();
		await page
			.getByRole("button", { name: "Criar cenário com equipes de exemplo" })
			.click();
		for (const phase of [
			"Seletiva 1",
			"Seletiva 2",
			"Fase suíça",
			"Playoffs",
		]) {
			await stages.getByRole("button", { name: phase, exact: true }).click();
			await fill.click();
			await expect(fill).toBeDisabled();
		}
	}
	await regions.getByRole("button", { name: "Final LATAM e LCQ" }).click();
	await fill.click();
	await expect(slots.getByText("A definir")).toHaveCount(0);
	await page.getByRole("button", { name: "Desfazer", exact: true }).click();
	await expect(slots.getByText("A definir")).toHaveCount(2);
	await fill.click();
	await page.reload();
	await expect(slots.getByText("A definir")).toHaveCount(0);
});

test("published results are locked, survive scenarios and reload, and support undo", async ({
	page,
}) => {
	await page.goto("/simulacoes/americas");
	const real = page.getByRole("article", {
		name: "Confronto Arashi contra TIME DO B3M",
	});
	await expect(real.getByText("Resultado real")).toBeVisible();
	await expect(
		real.getByRole("button", { name: "Escolher Arashi", exact: true }),
	).toBeDisabled();
	await expect(
		page.getByRole("button", { name: "Simular etapa" }),
	).toBeDisabled();
	await expect(page.getByRole("button", { name: "Limpar placar" })).toHaveCount(
		0,
	);
	await page.getByRole("button", { name: "Seletiva 2", exact: true }).click();
	await page.getByRole("button", { name: "Simular etapa" }).click();
	await page.reload();
	await expect(real.getByText("Resultado real")).toBeVisible();
	await page
		.getByRole("button", { name: "Criar cenário com equipes de exemplo" })
		.click();
	await expect(real).toHaveCount(0);
	await page.getByRole("button", { name: "Desfazer", exact: true }).click();
	await expect(real.getByText("Resultado real")).toBeVisible();
	await page.getByRole("button", { name: "Fase suíça", exact: true }).click();
	await expect(page.getByRole("article")).toHaveCount(8);
});
