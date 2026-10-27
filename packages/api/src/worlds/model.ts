import { z } from "zod";

export const RULES_VERSION = "worlds-2026-v1";
export const teamSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	code: z.string().min(1),
	image: z.string(),
	region: z.string(),
});
export const scoreSchema = z.tuple([
	z.number().int().min(0).max(3),
	z.number().int().min(0).max(3),
]);
export const matchSchema = z.object({
	id: z.string(),
	startTime: z.string().datetime(),
	phase: z.enum(["playin", "swiss", "quarter", "semi", "final"]),
	teams: z.tuple([z.string().nullable(), z.string().nullable()]),
	bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
	score: scoreSchema.nullable(),
});
export const snapshotSchema = z.object({
	id: z.string().min(1).max(100),
	importedAt: z.string().datetime(),
	source: z.enum(["riot", "admin"]),
	tournamentId: z.literal("115660540725177488"),
	teams: z.array(teamSchema).length(19),
	matches: z.array(matchSchema).length(46),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Team = z.infer<typeof teamSchema>;
export type Match = z.infer<typeof matchSchema>;
export type Score = z.infer<typeof scoreSchema>;
export const pickSchema = z.object({
	teams: z.tuple([z.string(), z.string()]),
	score: scoreSchema,
});
export const drawKeys = [
	"swiss-1",
	"swiss-2",
	"swiss-3",
	"swiss-4",
	"swiss-5",
	"quarter",
] as const;
export type DrawKey = (typeof drawKeys)[number];
export const scenarioSchema = z.object({
	name: z.string().trim().min(1).max(100),
	mode: z.enum(["beginning", "current"]),
	seed: z.number().int().min(1).max(2147483647),
	rulesVersion: z.literal(RULES_VERSION),
	drawSeeds: z
		.partialRecord(z.enum(drawKeys), z.number().int().min(1).max(2147483646))
		.optional(),
	picks: z
		.record(z.string().max(200), pickSchema)
		.refine((p) => Object.keys(p).length <= 46),
});
export type Scenario = z.infer<typeof scenarioSchema>;

export function validScore(score: Score, bestOf: number) {
	if (!score.every((value) => Number.isInteger(value) && value >= 0))
		return false;
	const target = Math.ceil(bestOf / 2);
	return (
		(score[0] === target && score[1] < target) ||
		(score[1] === target && score[0] < target)
	);
}

// Structural checks protect the explicit 2026 rules from an upstream format change.
export function validateSnapshot(value: unknown): Snapshot {
	const snapshot = snapshotSchema.parse(value);
	const ids = new Set(snapshot.teams.map((t) => t.id));
	if (ids.size !== 19 || ids.has("0"))
		throw new Error("Participantes inválidos no campeonato.");
	if (new Set(snapshot.matches.map((m) => m.id)).size !== 46)
		throw new Error("Partidas duplicadas.");
	const counts = { playin: 6, swiss: 33, quarter: 4, semi: 2, final: 1 };
	for (const [phase, count] of Object.entries(counts)) {
		if (snapshot.matches.filter((m) => m.phase === phase).length !== count)
			throw new Error(`Cobertura incompleta: ${phase}.`);
		const matches = snapshot.matches.filter((m) => m.phase === phase);
		if (
			matches.some(
				(m, i) => i > 0 && m.startTime < (matches[i - 1]?.startTime ?? ""),
			)
		)
			throw new Error(
				"As séries de cada fase precisam estar em ordem cronológica.",
			);
	}
	for (const match of snapshot.matches) {
		if (!match.startTime.startsWith("2026-"))
			throw new Error("A partida pertence a outra edição.");
		if (match.teams.some((t) => t !== null && !ids.has(t)))
			throw new Error("Equipe desconhecida.");
		if (match.teams[0] && match.teams[0] === match.teams[1])
			throw new Error("Uma equipe não pode enfrentar a si mesma.");
		if (
			match.score &&
			(!match.teams.every(Boolean) || !validScore(match.score, match.bestOf))
		)
			throw new Error("Placar real inválido.");
		if (
			(match.phase !== "swiss" && match.bestOf !== 5) ||
			(match.phase === "swiss" && match.bestOf === 5)
		)
			throw new Error("Formato de série inválido.");
	}
	const playin = snapshot.matches.filter((m) => m.phase === "playin");
	const swiss = snapshot.matches.filter((m) => m.phase === "swiss");
	if (
		new Set(
			playin
				.slice(0, 2)
				.flatMap((m) => m.teams)
				.filter(Boolean),
		).size !== 4 ||
		new Set(
			swiss
				.slice(0, 8)
				.flatMap((m) => m.teams)
				.filter(Boolean),
		).size !== 16
	)
		throw new Error("Sorteio inicial incompleto.");
	return snapshot;
}
