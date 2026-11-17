import { expect, test } from "@playwright/test";

const draftKey = "vct-brazil-2027-draft-v1";

test("Brazil is reachable from home and calendar; confirmed results are not editable", async ({
	page,
}) => {
	await page.goto("/");
	await page.getByRole("tab", { name: "Valorant", exact: true }).click();
	await page
		.getByRole("link", { name: "Simular qualificatório brasileiro" })
		.click();
	await expect(
		page.getByRole("heading", {
			name: "Qualificatório brasileiro",
			exact: true,
		}),
	).toBeVisible();
	await page
		.getByRole("button", { name: "Participantes", exact: true })
		.click();
	await expect(
		page
			.getByRole("region", { name: "Participantes brasileiros" })
			.getByRole("listitem"),
	).toHaveCount(16);
	await page
		.getByRole("button", { name: "Resultados das seletivas", exact: true })
		.click();
	const forfeit = page.getByRole("article", {
		name: "Seletiva 2: Master Bank contra 0 intelecto",
	});
	await expect(
		forfeit.getByText("W.O. · Master Bank avança", { exact: true }),
	).toBeVisible();
	await expect(forfeit.getByRole("button")).toHaveCount(0);
	await expect(
		forfeit.getByText("Resultado real · não editável"),
	).toBeVisible();
	await page.goto("/calendario?game=valorant");
	await page
		.getByRole("link", { name: "Simular qualificatório brasileiro" })
		.click();
	await expect(page).toHaveURL(/\/simulacoes\/brasil$/);
});

test("Brazil Swiss and playoffs finish, persist, and undo without changing real results", async ({
	page,
}) => {
	await page.addInitScript(() => {
		Math.random = () => 0.25;
	});
	await page.goto("/simulacoes/brasil");
	const stages = page.getByRole("navigation", {
		name: "Etapas do qualificatório brasileiro",
	});
	const fill = page.getByRole("button", { name: "Simular etapa", exact: true });
	const slots = page.getByRole("region", { name: "Vagas brasileiras" });
	await expect(slots.getByText("A definir", { exact: true })).toHaveCount(2);
	await fill.click();
	await expect(
		page.getByRole("heading", { name: "Classificação · 8/8 nos playoffs" }),
	).toBeVisible();
	await stages.getByRole("button", { name: "Playoffs", exact: true }).click();
	await fill.click();
	await expect(slots.getByText("A definir", { exact: true })).toHaveCount(0);
	const champion = await slots.locator("p.text-xl").first().textContent();
	await page.getByRole("button", { name: "Desfazer", exact: true }).click();
	await expect(slots.getByText("A definir", { exact: true })).toHaveCount(2);
	await fill.click();
	await page.reload();
	await expect(slots.getByText("A definir", { exact: true })).toHaveCount(0);
	await expect(slots.locator("p.text-xl").first()).toHaveText(champion ?? "");
	await page
		.getByRole("button", { name: "Reiniciar simulação", exact: true })
		.click();
	await expect(slots.getByText("A definir", { exact: true })).toHaveCount(2);
	await page.getByRole("button", { name: "Desfazer", exact: true }).click();
	await expect(slots.getByText("A definir", { exact: true })).toHaveCount(0);
	await stages
		.getByRole("button", { name: "Resultados das seletivas", exact: true })
		.click();
	await expect(
		page.getByText("W.O. · Master Bank avança", { exact: true }),
	).toBeVisible();
});

test("Brazil recovers from malformed storage and remains usable when saving fails", async ({
	page,
}) => {
	await page.addInitScript((key) => {
		localStorage.setItem(key, "{broken");
	}, draftKey);
	await page.goto("/simulacoes/brasil");
	await expect(
		page.getByRole("heading", {
			name: "Qualificatório brasileiro",
			exact: true,
		}),
	).toBeVisible();
	await page.evaluate(() => {
		Storage.prototype.setItem = () => {
			throw new Error("quota");
		};
	});
	await page
		.getByRole("button", { name: "Simular etapa", exact: true })
		.click();
	await expect(page.getByRole("alert")).toContainText(
		"Não foi possível salvar no navegador",
	);
	await expect(
		page.getByRole("heading", { name: "Classificação · 8/8 nos playoffs" }),
	).toBeVisible();
});
