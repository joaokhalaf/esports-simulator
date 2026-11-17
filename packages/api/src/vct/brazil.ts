import { z } from "zod";
import { pickSchema, type Score, validScore } from "../worlds/model";
import {
	americasTeams,
	applyAmericasPublished,
	newAmericasDraft,
	type QualifierStage,
	simulateAmericas,
} from "./americas";
import { americasPublished } from "./published";

export const brazilSnapshot = {
	version: "brazil-2027-2026-11-17" as const,
	checkedAt: "17/11/2026",
	open1: [...americasPublished.br.qualified],
	open2: ["SÓ TEM VELHO", "ARRANCA DREAMS", "Master Bank", "0 intelecto"],
	invited: [...americasPublished.br.invited],
	sources: [
		{
			label: "Formato e datas · Riot Games",
			url: "https://valorantesports.com/pt-BR/news/2027-vct-americas-kickoff-brazil-qualifiers",
		},
		{
			label: "Seletivas e resultados · VLR",
			url: "https://www.vlr.gg/event/3187/vct-2027-america-kickoff-brazil-open-qualifier",
		},
		{
			label: "16 participantes · VLR",
			url: "https://www.vlr.gg/event/3183/vct-2027-america-kickoff-brazil-qualifier-playoffs/swiss-stage",
		},
		{
			label: "Classificados da seletiva 1 · THESPIKE",
			url: "https://www.thespike.gg/br/valorant/news/valorant-veja-times-venceram-qualify-aberto-kickoff/9213",
		},
	],
};

type RealResult = {
	id: string;
	stage: "Seletiva 1" | "Seletiva 2";
	teams: readonly [string, string];
	label: string;
	outcome:
		| { kind: "played"; score: Score }
		| { kind: "forfeit"; winner: string };
};

export const brazilResults: readonly RealResult[] = [
	...americasPublished.br.matches.map(
		(match, index): RealResult => ({
			id: `open1-${index}`,
			stage: "Seletiva 1",
			teams: match.teams,
			label: match.label,
			outcome: { kind: "played", score: match.score },
		}),
	),
	{
		id: "open2-quarter",
		stage: "Seletiva 2",
		teams: ["Master Bank", "OS RELAXADOS"],
		label: "Quartas de final",
		outcome: { kind: "played", score: [2, 0] },
	},
	{
		id: "open2-semi-1",
		stage: "Seletiva 2",
		teams: ["Master Bank", "ARRANCA DREAMS"],
		label: "Semifinal",
		outcome: { kind: "played", score: [0, 2] },
	},
	{
		id: "open2-semi-2",
		stage: "Seletiva 2",
		teams: ["SÓ TEM VELHO", "0 intelecto"],
		label: "Semifinal",
		outcome: { kind: "played", score: [2, 0] },
	},
	{
		id: "open2-seed-1",
		stage: "Seletiva 2",
		teams: ["ARRANCA DREAMS", "SÓ TEM VELHO"],
		label: "Definição de seed · 1–2",
		outcome: { kind: "played", score: [1, 2] },
	},
	{
		id: "open2-seed-2",
		stage: "Seletiva 2",
		teams: ["Master Bank", "0 intelecto"],
		label: "Definição de seed · 3–4",
		outcome: { kind: "forfeit", winner: "Master Bank" },
	},
];

const draftSchema = z.object({
	version: z.literal(brazilSnapshot.version),
	picks: z
		.record(z.string().max(100), pickSchema)
		.refine((picks) => Object.keys(picks).length <= 64),
});
export type BrazilDraft = z.infer<typeof draftSchema>;
export type BrazilStage = Extract<QualifierStage, "swiss" | "playoffs">;

export function newBrazilDraft(): BrazilDraft {
	return { version: brazilSnapshot.version, picks: {} };
}

function regionalDraft(draft: BrazilDraft) {
	const base = applyAmericasPublished(newAmericasDraft(), "br");
	return {
		...base,
		rosters: {
			...base.rosters,
			br: { ...base.rosters.br, open2: [...brazilSnapshot.open2] },
		},
		picks: draft.picks,
	};
}

export function simulateBrazil(
	draft: BrazilDraft,
	fill?: Parameters<typeof simulateAmericas>[1],
) {
	const base = regionalDraft(draft);
	const result = simulateAmericas(base, (match) =>
		match.region === "br" ? fill?.(match) : undefined,
	);
	const region = result.regions.br;
	return {
		matches: result.matches.filter(
			(match) =>
				match.region === "br" &&
				(match.stage === "swiss" || match.stage === "playoffs"),
		),
		picks: Object.fromEntries(
			Object.entries(result.picks).filter(([id]) => id.startsWith("br/")),
		),
		teams: americasTeams(base),
		standings: region.standings,
		qualified: region.qualified,
		champion: region.final.winner,
		runnerUp: region.final.loser,
	};
}

export function parseBrazilDraft(value: unknown): BrazilDraft | null {
	const result = draftSchema.safeParse(value);
	if (!result.success) return null;
	return {
		version: result.data.version,
		picks: simulateBrazil(result.data).picks,
	};
}

export function setBrazilScore(
	draft: BrazilDraft,
	id: string,
	score: Score | null,
): BrazilDraft {
	const current = simulateBrazil(draft);
	const match = current.matches.find((item) => item.id === id);
	if (
		!match?.teams[0] ||
		!match.teams[1] ||
		(score && !validScore(score, match.bestOf))
	)
		return draft;
	const picks = { ...current.picks };
	if (score) picks[id] = { teams: [match.teams[0], match.teams[1]], score };
	else delete picks[id];
	return {
		version: draft.version,
		picks: simulateBrazil({ ...draft, picks }).picks,
	};
}

export function simulateBrazilStage(
	draft: BrazilDraft,
	stage: BrazilStage,
	random = Math.random,
): BrazilDraft {
	const result = simulateBrazil(draft, (match) => {
		if (match.stage !== stage) return undefined;
		const target = Math.ceil(match.bestOf / 2);
		const loser = Math.min(target - 1, Math.floor(random() * target));
		return random() < 0.5 ? [target, loser] : [loser, target];
	});
	return { version: draft.version, picks: result.picks };
}
