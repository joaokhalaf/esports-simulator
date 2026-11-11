import { z } from "zod";
import { pickSchema, type Score, validScore } from "../worlds/model";
import { americasPublished, americasSnapshotVersion } from "./published";

const latamSource =
	"https://valorantesports.com/es-MX/valorantesports/news/2027-vct-americas-kickoff-latam-qualifiers";

export const americasRegions = {
	br: {
		name: "Brasil",
		openSpots: 4,
		dates: [
			"5–7 e 9 nov.",
			"12–14 e 16 nov.",
			"20–22 nov.",
			"26–29 nov. e 3–6 dez.",
		],
		source:
			"https://valorantesports.com/pt-BR/news/2027-vct-americas-kickoff-brazil-qualifiers",
	},
	na: {
		name: "América do Norte",
		openSpots: 4,
		dates: ["5–8 nov.", "12–15 nov.", "20–22 nov.", "1–6 dez."],
		source:
			"https://valorantesports.com/en-US/news/2027-vct-americas-kickoff-north-america-qualifiers",
	},
	"latam-north": {
		name: "LATAM Norte",
		openSpots: 2,
		dates: ["5–8 nov.", "12–15 nov.", "20, 22 e 24 nov.", "28 nov. e 4–6 dez."],
		source: latamSource,
	},
	"latam-south": {
		name: "LATAM Sul",
		openSpots: 2,
		dates: [
			"5–8 nov.",
			"12–15 nov.",
			"21, 23 e 25 nov.",
			"29 nov. e 3, 5 e 6 dez.",
		],
		source: latamSource,
	},
} as const;

export const americasRegionIds = [
	"br",
	"na",
	"latam-north",
	"latam-south",
] as const;
export type AmericasRegion = (typeof americasRegionIds)[number];
export type QualifierStage =
	| "open1"
	| "open2"
	| "swiss"
	| "playoffs"
	| "latam"
	| "lcq";
type Rosters = { open1: string[]; open2: string[]; invited: string[] };
type Picks = Record<string, z.infer<typeof pickSchema>>;

export type AmericasDraft = {
	rosters: Record<AmericasRegion, Rosters>;
	picks: Picks;
	publishedRegions?: AmericasRegion[];
	snapshotVersion?: typeof americasSnapshotVersion;
	lcqEliminated?: string;
};

type Entrant = string | null;
type SeriesResult = { winner: Entrant; loser: Entrant };
type Standing = {
	team: string;
	wins: number;
	losses: number;
	maps: number;
	seed: number;
};

export type QualifierMatch = {
	id: string;
	region: AmericasRegion | "finals";
	stage: QualifierStage;
	round: string;
	label: string;
	bestOf: 3 | 5;
	teams: [Entrant, Entrant];
	score: Score | null;
	origin: "simulated" | "real" | null;
};

const names = z.array(z.string().trim().min(1).max(60)).max(512);
const rosterSchema = z.object({ open1: names, open2: names, invited: names });
const draftSchema = z.object({
	rosters: z.record(z.enum(americasRegionIds), rosterSchema),
	picks: z.record(z.string(), pickSchema),
	lcqEliminated: z.string().optional(),
	publishedRegions: z.array(z.enum(americasRegionIds)).optional(),
	snapshotVersion: z.literal(americasSnapshotVersion).optional(),
});

const teamKey = (name: string) => name.trim().toLowerCase();
const teamId = (region: AmericasRegion, name: string) =>
	`${region}:${teamKey(name)}`;

export function validRosters(region: AmericasRegion, roster: Rosters) {
	const { openSpots } = americasRegions[region];
	const lists = [roster.open1, roster.open2, roster.invited];
	if (
		lists.some(
			(list) =>
				!names.safeParse(list).success ||
				new Set(list.map(teamKey)).size !== list.length,
		)
	)
		return false;
	if (roster.invited.length !== openSpots * 2) return false;
	if (roster.open1.length < openSpots || roster.open2.length < openSpots)
		return false;
	const opens = new Set([...roster.open1, ...roster.open2].map(teamKey));
	return roster.invited.every((team) => !opens.has(teamKey(team)));
}

export function parseAmericasDraft(value: unknown): AmericasDraft | null {
	const parsed = draftSchema.safeParse(value);
	if (
		!parsed.success ||
		!americasRegionIds.every((region) =>
			parsed.data.publishedRegions?.includes(region)
				? parsed.data.snapshotVersion === americasSnapshotVersion &&
					JSON.stringify(parsed.data.rosters[region]) ===
						JSON.stringify(publishedRoster(region))
				: validRosters(region, parsed.data.rosters[region]),
		)
	)
		return null;
	return parsed.data;
}

export function newAmericasDraft(): AmericasDraft {
	function roster(region: AmericasRegion): Rosters {
		const { openSpots } = americasRegions[region];
		const examples = (label: string) =>
			Array.from(
				{ length: openSpots * 2 },
				(_, index) => `${label} · ${index + 1}`,
			);
		return {
			open1: examples("Seletiva 1"),
			open2: examples("Seletiva 2"),
			invited: examples("Convidado"),
		};
	}
	return {
		rosters: {
			br: roster("br"),
			na: roster("na"),
			"latam-north": roster("latam-north"),
			"latam-south": roster("latam-south"),
		},
		picks: {},
	};
}

function publishedRoster(region: AmericasRegion): Rosters {
	const data = americasPublished[region];
	return {
		open1: [...data.qualified],
		open2: Array.from(
			{ length: americasRegions[region].openSpots * 2 },
			(_, i) => `Seletiva 2 · equipe a confirmar ${i + 1}`,
		),
		invited: [...data.invited],
	};
}

/** Update one region; dependency validation retains unrelated predictions. */
export function applyAmericasPublished(
	draft: AmericasDraft,
	region: AmericasRegion,
): AmericasDraft {
	const next: AmericasDraft = {
		...draft,
		rosters: { ...draft.rosters, [region]: publishedRoster(region) },
		publishedRegions: [...new Set([...(draft.publishedRegions ?? []), region])],
		snapshotVersion: americasSnapshotVersion,
	};
	const result = simulateAmericas(next);
	return { ...next, picks: result.picks, lcqEliminated: result.lcqEliminated };
}

function seedOrder(size: number): number[] {
	let seeds = [1];
	for (let length = 2; length <= size; length *= 2) {
		seeds = seeds.flatMap((seed) => [seed, length + 1 - seed]);
	}
	return seeds;
}

function matchupKey(a: string, b: string) {
	return JSON.stringify([a, b].sort());
}

function swissPairings(
	teams: string[],
	played: Set<string>,
): [string, string][] | null {
	const first = teams[0];
	if (!first) return [];
	for (let index = teams.length - 1; index >= 1; index--) {
		const opponent = teams[index];
		if (!opponent) continue;
		if (played.has(matchupKey(first, opponent))) continue;
		const rest = swissPairings(
			teams.slice(1).filter((_, offset) => offset + 1 !== index),
			played,
		);
		if (rest) return [[first, opponent], ...rest];
	}
	return null;
}

function updateStandings(
	standings: Map<string, Standing>,
	match: QualifierMatch,
) {
	const [a, b] = match.teams;
	if (!match.score || !a || !b) return;
	const [left, right] = match.score;
	const home = standings.get(a);
	const away = standings.get(b);
	if (!home || !away) return;
	home.maps += left - right;
	away.maps += right - left;
	if (left > right) {
		home.wins++;
		away.losses++;
	} else {
		away.wins++;
		home.losses++;
	}
}

const standingsOrder = (a: Standing, b: Standing) =>
	b.wins - a.wins || b.maps - a.maps || a.seed - b.seed;

export function simulateAmericas(
	draft: AmericasDraft,
	fillScore?: (match: QualifierMatch) => Score | undefined,
) {
	const matches: QualifierMatch[] = [];
	const picks: Picks = {};

	function play(
		region: QualifierMatch["region"],
		stage: QualifierStage,
		key: string,
		round: string,
		label: string,
		bestOf: QualifierMatch["bestOf"],
		a: Entrant,
		b: Entrant,
	): QualifierMatch & SeriesResult {
		const id = [region, stage, key].join("/");
		const match: QualifierMatch = {
			id,
			region,
			stage,
			round,
			label,
			bestOf,
			teams: [a, b],
			score: null,
			origin: null,
		};
		const pick = draft.picks[id];
		if (a && b && a !== b) {
			const saved =
				pick && pick.teams[0] === a && pick.teams[1] === b
					? pick.score
					: undefined;
			const score = saved ?? fillScore?.(match);
			if (score && validScore(score, bestOf)) {
				match.score = score;
				match.origin = "simulated";
				picks[id] = { teams: [a, b], score };
			}
		}
		matches.push(match);
		if (!match.score) return { ...match, winner: null, loser: null };
		const firstWon = match.score[0] > match.score[1];
		return { ...match, winner: firstWon ? a : b, loser: firstWon ? b : a };
	}

	function open(
		region: AmericasRegion,
		stage: "open1" | "open2",
		entrants: string[],
		spots: number,
	) {
		if (entrants.length < spots) return [];
		const size = 2 ** Math.ceil(Math.log2(entrants.length));
		// undefined is a bye, null is a slot whose previous series has not finished.
		let slots: (Entrant | undefined)[] = seedOrder(size).map(
			(seed) => entrants[seed - 1],
		);
		for (let round = 1; slots.length > spots; round++) {
			const next: Entrant[] = [];
			for (let index = 0; index < slots.length; index += 2) {
				const a = slots[index];
				const b = slots[index + 1];
				if (a === undefined || b === undefined) {
					next.push(a ?? b ?? null);
				} else {
					next.push(
						play(
							region,
							stage,
							`${round}-${index}`,
							`Rodada ${round}`,
							`Série ${index / 2 + 1}`,
							3,
							a,
							b,
						).winner,
					);
				}
			}
			slots = next;
		}
		const advanced = new Set(slots);
		return slots.every((team) => typeof team === "string")
			? entrants.filter((team) => advanced.has(team))
			: [];
	}

	function swiss(region: AmericasRegion, entrants: string[]) {
		const records = new Map(
			entrants.map((team, seed) => [
				team,
				{ team, seed, wins: 0, losses: 0, maps: 0 },
			]),
		);
		const played = new Set<string>();
		for (let round = 1; round <= 3; round++) {
			const groups = new Map<string, string[]>();
			for (const { team, wins, losses } of records.values()) {
				if (wins === 2 || losses === 2) continue;
				const key = `${wins}-${losses}`;
				const group = groups.get(key) ?? [];
				group.push(team);
				groups.set(key, group);
			}
			let pending = false;
			for (const [record, group] of [...groups.entries()].sort(([a], [b]) =>
				b.localeCompare(a),
			)) {
				const pairs = swissPairings(group, played);
				if (!pairs) throw new Error("Não foi possível montar a rodada suíça.");
				pairs.forEach(([a, b], index) => {
					const match = play(
						region,
						"swiss",
						[round, record, index].join("-"),
						`Rodada ${round} · ${record}`,
						`Série ${index + 1}`,
						3,
						a,
						b,
					);
					played.add(matchupKey(a, b));
					updateStandings(records, match);
					pending ||= !match.score;
				});
			}
			if (pending) break;
		}
		return [...records.values()].sort(standingsOrder);
	}

	function playoffs(region: AmericasRegion, seeds: Entrant[]) {
		const series = (
			key: string,
			round: string,
			label: string,
			a: Entrant | undefined,
			b: Entrant | undefined,
			bestOf: 3 | 5 = 3,
		) =>
			play(region, "playoffs", key, round, label, bestOf, a ?? null, b ?? null);
		const seeded = seedOrder(seeds.length).map((seed) => seeds[seed - 1]);
		const first = Array.from({ length: seeds.length / 2 }, (_, index) =>
			series(
				`upper-${index}`,
				"Chave superior",
				(seeds.length === 8 ? "Quartas " : "Semifinal ") + (index + 1),
				seeded[index * 2],
				seeded[index * 2 + 1],
			),
		);
		let upper = first;
		let lower: Entrant;
		if (first.length === 4) {
			upper = [0, 2].map((index, slot) =>
				series(
					`semi-${slot}`,
					"Chave superior",
					`Semifinal ${slot + 1}`,
					first[index]?.winner,
					first[index + 1]?.winner,
				),
			);
			const lowerOpen = [0, 2].map((index, slot) =>
				series(
					`lower-1-${slot}`,
					"Chave inferior",
					`Rodada 1 · Série ${slot + 1}`,
					first[index]?.loser,
					first[index + 1]?.loser,
				),
			);
			const lowerNext = lowerOpen.map((match, index) =>
				series(
					`lower-2-${index}`,
					"Chave inferior",
					`Rodada 2 · Série ${index + 1}`,
					match.winner,
					upper[1 - index]?.loser,
				),
			);
			lower = series(
				"lower-semi",
				"Chave inferior",
				"Semifinal inferior",
				lowerNext[0]?.winner,
				lowerNext[1]?.winner,
			).winner;
		} else {
			lower = series(
				"lower-1",
				"Chave inferior",
				"Rodada 1",
				first[0]?.loser,
				first[1]?.loser,
			).winner;
		}
		const upperFinal = series(
			"upper-final",
			"Chave superior",
			"Final superior",
			upper[0]?.winner,
			upper[1]?.winner,
			5,
		);
		const lowerFinal = series(
			"lower-final",
			"Chave inferior",
			"Final inferior",
			lower,
			upperFinal.loser,
			5,
		);
		return series(
			"grand-final",
			"Grande final",
			"Final regional",
			upperFinal.winner,
			lowerFinal.winner,
			5,
		);
	}

	function regional(region: AmericasRegion) {
		const roster = draft.rosters[region];
		const { openSpots } = americasRegions[region];
		const published = draft.publishedRegions?.includes(region);
		const open1 = published
			? americasPublished[region].qualified.map((name) => teamId(region, name))
			: open(
					region,
					"open1",
					roster.open1.map((name) => teamId(region, name)),
					openSpots,
				);
		if (published) {
			americasPublished[region].matches.forEach((result, index) => {
				matches.push({
					id: `${region}/open1/published-${index}`,
					region,
					stage: "open1",
					round: "Resultados reais · seletiva 1",
					label: result.label,
					bestOf: 3,
					teams: result.teams.map((name) => teamId(region, name)) as [
						string,
						string,
					],
					score: result.score,
					origin: "real",
				});
			});
		}
		const open2Entrants = roster.open2
			.map((name) => teamId(region, name))
			.filter((team) => !open1.includes(team));
		const open2 =
			open1.length ===
			(published ? americasPublished[region].qualified.length : openSpots)
				? open(region, "open2", open2Entrants, openSpots)
				: [];
		const entrants = [
			...roster.invited.map((name) => teamId(region, name)),
			...open1,
			...open2,
		];
		const standings =
			entrants.length === openSpots * 4 ? swiss(region, entrants) : [];
		const qualified = standings
			.filter((team) => team.wins === 2)
			.map((team) => team.team);
		const seeds =
			qualified.length === openSpots * 2
				? qualified
				: Array<Entrant>(openSpots * 2).fill(null);
		return {
			open1,
			open2,
			standings,
			qualified,
			final: playoffs(region, seeds),
			open2Short: open1.length > 0 && open2Entrants.length < openSpots,
		};
	}

	const regions = {
		br: regional("br"),
		na: regional("na"),
		"latam-north": regional("latam-north"),
		"latam-south": regional("latam-south"),
	};
	const latam = play(
		"finals",
		"latam",
		"final",
		"Final LATAM",
		"Norte x Sul",
		5,
		regions["latam-north"].final.winner,
		regions["latam-south"].final.winner,
	);
	const runnersUp = [
		regions.br.final.loser,
		regions.na.final.loser,
		latam.loser,
	] as const;
	const lcqRecords = new Map(
		runnersUp.flatMap((team, seed) =>
			team
				? [[team, { team, seed, wins: 0, losses: 0, maps: 0 }] as const]
				: [],
		),
	);
	const groupMatches = (
		[
			[0, 1],
			[0, 2],
			[1, 2],
		] as const
	).map(([a, b], index) =>
		play(
			"finals",
			"lcq",
			`group-${index}`,
			"Todos contra todos",
			`Série ${index + 1}`,
			3,
			runnersUp[a],
			runnersUp[b],
		),
	);
	for (const match of groupMatches) updateStandings(lcqRecords, match);
	const lcqStandings = [...lcqRecords.values()].sort(standingsOrder);
	const groupComplete = groupMatches.every((match) => match.score);
	let tied: string[] = [];
	const last = lcqStandings[2];
	if (groupComplete && last) {
		const equal = lcqStandings.filter(
			(team) => team.wins === last.wins && team.maps === last.maps,
		);
		if (equal.length > 1) tied = equal.map((team) => team.team);
	}
	const lcqEliminated =
		draft.lcqEliminated && tied.includes(draft.lcqEliminated)
			? draft.lcqEliminated
			: undefined;
	const finalists =
		groupComplete && (!tied.length || lcqEliminated)
			? lcqStandings.filter((team) => team.team !== lcqEliminated).slice(0, 2)
			: [];
	const lcq = play(
		"finals",
		"lcq",
		"final",
		"Final do LCQ",
		"Última vaga",
		5,
		finalists[0]?.team ?? null,
		finalists[1]?.team ?? null,
	);

	return {
		matches,
		picks,
		regions,
		lcqStandings,
		tied,
		lcqEliminated,
		qualifiers: {
			br: regions.br.final.winner,
			na: regions.na.final.winner,
			latam: latam.winner,
			lcq: lcq.winner,
		},
	};
}

export function americasTeams(draft: AmericasDraft) {
	return new Map(
		americasRegionIds.flatMap((region) =>
			[
				...Object.values(draft.rosters[region]).flat(),
				...(draft.publishedRegions?.includes(region)
					? americasPublished[region].matches.flatMap((match) => match.teams)
					: []),
			].map((name) => {
				const id = teamId(region, name);
				return [
					id,
					{
						id,
						name,
						code: name,
						region: americasRegions[region].name,
						image: "",
					},
				] as const;
			}),
		),
	);
}
