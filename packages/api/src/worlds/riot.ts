import { createHash } from "node:crypto";
import { z } from "zod";
import { validateRealProgression } from "./engine";
import {
	type Match,
	type Snapshot,
	type Team,
	validateSnapshot,
} from "./model";

const SITE = "https://lolesports.com";
const ENDPOINT = `${SITE}/api/gql`;
const TOURNAMENT = "115660540725177488";
let operationId =
	"e4da9fd0ab89ecdb783912d74799688d1f52f1edc9b87497d3409c74d9b4291a";
const rawTeam = z.object({
	teamId: z.string(),
	name: z.string(),
	code: z.string(),
	image: z.string().nullable(),
	homeLeague: z.object({ regionSlug: z.string().nullable() }).nullable(),
	result: z
		.object({ gameWins: z.number(), outcome: z.string().nullable() })
		.nullable(),
});
const responseSchema = z.object({
	data: z.object({
		esports: z.object({
			events: z.array(
				z.object({
					id: z.string(),
					startTime: z.string(),
					blockName: z.string(),
					state: z.string(),
					tournament: z.object({ id: z.string() }),
					matchTeams: z.array(rawTeam).length(2),
					match: z.object({
						strategy: z.object({
							type: z.literal("bestOf"),
							count: z.union([z.literal(1), z.literal(3), z.literal(5)]),
						}),
					}),
				}),
			),
			pages: z.object({
				older: z.string().nullable(),
				newer: z.string().nullable(),
			}),
		}),
	}),
});

async function read(url: string, init?: RequestInit) {
	const response = await fetch(url, {
		...init,
		signal: AbortSignal.timeout(12000),
	});
	if (!response.ok)
		throw new Error(`LoL Esports respondeu HTTP ${response.status}.`);
	const body = await response.text();
	if (body.length > 8_000_000)
		throw new Error("Resposta da Riot excedeu o tamanho esperado.");
	return body;
}

// Read the site's public manifest; never execute downloaded JavaScript.
async function discoverOperation() {
	const html = await read(`${SITE}/pt-BR/`);
	const scripts = [
		...html.matchAll(
			/<script[^>]+src="(\/_next\/static\/chunks\/[\w.-]+\.js)"/g,
		),
	]
		.map((m) => m[1])
		.filter((s): s is string => !!s)
		.slice(0, 60);
	const chunks = await Promise.all(
		scripts.map(async (path) => read(`${SITE}${path}`)),
	);
	const candidates = new Set<string>();
	for (const chunk of chunks)
		for (const m of chunk.matchAll(/"(static\/chunks\/[\w.-]+\.js)"/g))
			if (m[1]) candidates.add(m[1]);
	for (const path of [...candidates].slice(0, 40)) {
		const content = await read(`${SITE}/_next/${path}`);
		if (!content.includes("apollo-persisted-query-manifest")) continue;
		const id = content.match(/"id":"([a-f0-9]{64})","name":"homeEvents"/)?.[1];
		if (id) {
			operationId = id;
			return;
		}
	}
	throw new Error(
		"O site alterou o manifesto de consultas. A importação precisa ser atualizada.",
	);
}

export function makeSnapshot(
	data: Omit<Snapshot, "id" | "importedAt">,
	importedAt = new Date().toISOString(),
): Snapshot {
	const id = createHash("sha256").update(JSON.stringify(data)).digest("hex");
	const snapshot = validateSnapshot({ ...data, id, importedAt });
	validateRealProgression(snapshot);
	return snapshot;
}

export function normalizeRiot(payload: unknown): Snapshot {
	const response = responseSchema.parse(payload);
	const events = response.data.esports.events;
	if (response.data.esports.pages.older || response.data.esports.pages.newer)
		throw new Error(
			"A API retornou dados paginados; importação incompleta recusada.",
		);
	const teams = new Map<string, Team>();
	const phases: Record<string, Match["phase"]> = {
		"Fase de Entrada": "playin",
		"Fase Suíça": "swiss",
		"Quartas de Final": "quarter",
		Semifinais: "semi",
		Finais: "final",
	};
	const matches: Match[] = events.map((event) => {
		if (
			event.tournament.id !== TOURNAMENT ||
			!event.startTime.startsWith("2026-")
		)
			throw new Error("A API retornou outra edição do campeonato.");
		const phase = phases[event.blockName];
		if (!phase) throw new Error(`Fase não suportada: ${event.blockName}.`);
		for (const team of event.matchTeams)
			if (team.teamId !== "0")
				teams.set(team.teamId, {
					id: team.teamId,
					name: team.name,
					code: team.code,
					image: (team.image ?? "").replace(/^http:/, "https:"),
					region: team.homeLeague?.regionSlug ?? "",
				});
		const a = event.matchTeams[0];
		const b = event.matchTeams[1];
		if (!a || !b) throw new Error("Adversários ausentes.");
		return {
			id: event.id,
			startTime: event.startTime,
			phase,
			teams: [
				a.teamId === "0" ? null : a.teamId,
				b.teamId === "0" ? null : b.teamId,
			],
			bestOf: event.match.strategy.count,
			score:
				event.state === "completed" && a.result && b.result
					? [a.result.gameWins, b.result.gameWins]
					: null,
		};
	});
	matches.sort(
		(a, b) =>
			a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id),
	);
	return makeSnapshot({
		source: "riot",
		tournamentId: TOURNAMENT,
		teams: [...teams.values()].sort((a, b) => a.id.localeCompare(b.id)),
		matches,
	});
}

let cache: { value: Snapshot; until: number } | undefined;
let pending: Promise<Snapshot> | undefined;
let retryAfter = 0;
export function importWorlds(): Promise<Snapshot> {
	if (cache && cache.until > Date.now()) return Promise.resolve(cache.value);
	if (pending) return pending;
	if (Date.now() < retryAfter)
		return Promise.reject(
			new Error(
				"Importação temporariamente indisponível. Tente novamente em 30 segundos.",
			),
		);
	pending = (async () => {
		const request = async () => {
			const url = new URL(ENDPOINT);
			url.searchParams.set("operationName", "homeEvents");
			url.searchParams.set(
				"variables",
				JSON.stringify({
					hl: "pt-BR",
					sport: ["lol"],
					leagues: ["98767975604431411"],
					eventDateStart: "2026-01-01",
					eventDateEnd: "2026-12-31",
					pageSize: 100,
				}),
			);
			url.searchParams.set(
				"extensions",
				JSON.stringify({
					persistedQuery: { version: 1, sha256Hash: operationId },
				}),
			);
			return JSON.parse(
				await read(url.toString(), {
					headers: {
						"content-type": "application/json",
						"apollographql-client-name": "Esports Web",
						"apollographql-client-version": "1.0",
					},
				}),
			) as { errors?: { extensions?: { code?: string } }[] };
		};
		let payload = await request();
		if (
			payload.errors?.some((e) =>
				e.extensions?.code?.startsWith("PERSISTED_QUERY"),
			)
		) {
			await discoverOperation();
			payload = await request();
		}
		const value = normalizeRiot(payload);
		cache = { value, until: Date.now() + 300_000 };
		return value;
	})()
		.catch((error: unknown) => {
			retryAfter = Date.now() + 30_000;
			throw error;
		})
		.finally(() => {
			pending = undefined;
		});
	return pending;
}
