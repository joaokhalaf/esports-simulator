import {
	type DrawKey,
	drawKeys,
	type Match,
	RULES_VERSION,
	type Scenario,
	type Score,
	type Snapshot,
	validScore,
} from "./model";

export type SimMatch = Omit<Match, "score"> & {
	score: Score | null;
	origin: "real" | "simulated" | null;
	round: string;
	draw: "official" | "simulated";
};
export type Standing = { teamId: string; wins: number; losses: number };
export type Simulation = {
	matches: SimMatch[];
	standings: Standing[];
	champion: string | null;
	blocked: string | null;
};

export function validateRealProgression(snapshot: Snapshot) {
	const replay = simulate(snapshot, {
		name: "Validação dos dados reais",
		mode: "current",
		seed: 1,
		rulesVersion: RULES_VERSION,
		picks: {},
	});
	for (const match of snapshot.matches.filter((m) => m.score)) {
		if (replay.matches.find((m) => m.id === match.id)?.origin !== "real")
			throw new Error(
				`Resultado incompatível com o avanço entre fases: ${match.id}. Corrija também os adversários ou limpe os resultados dependentes.`,
			);
	}
}
const pairKey = (a: string, b: string) => [a, b].sort().join(":");

function random(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(1664525, state) + 1013904223) >>> 0;
		return state / 4294967296;
	};
}
function shuffle<T>(items: T[], next: () => number): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(next() * (i + 1));
		const a = result[i];
		const b = result[j];
		if (a !== undefined && b !== undefined) {
			result[i] = b;
			result[j] = a;
		}
	}
	return result;
}
function pairTeams(
	ids: string[],
	allowed: (a: string, b: string) => boolean,
): [string, string][] | null {
	if (!ids.length) return [];
	const first = ids[0];
	if (!first) return null;
	for (let i = 1; i < ids.length; i++) {
		const other = ids[i];
		if (!other || !allowed(first, other)) continue;
		const rest = pairTeams(
			ids.filter((_, j) => j !== 0 && j !== i),
			allowed,
		);
		if (rest) return [[first, other], ...rest];
	}
	return null;
}

export function simulate(snapshot: Snapshot, scenario: Scenario): Simulation {
	const result: Simulation = {
		matches: [],
		standings: [],
		champion: null,
		blocked: null,
	};
	const next = random(scenario.seed);
	const phase = (p: Match["phase"]) =>
		snapshot.matches.filter((m) => m.phase === p);
	function resolve(
		base: Match,
		teams: Match["teams"],
		bestOf: Match["bestOf"],
		round: string,
		draw: SimMatch["draw"] = "official",
	) {
		const pick = scenario.picks[base.id];
		const sameReal = teams[0] === base.teams[0] && teams[1] === base.teams[1];
		let score: Score | null = null;
		let origin: SimMatch["origin"] = null;
		if (teams[0] && teams[1]) {
			if (
				scenario.mode === "current" &&
				sameReal &&
				base.score &&
				base.bestOf === bestOf
			) {
				score = base.score;
				origin = "real";
			} else if (
				pick &&
				pick.teams[0] === teams[0] &&
				pick.teams[1] === teams[1] &&
				validScore(pick.score, bestOf)
			) {
				score = pick.score;
				origin = "simulated";
			}
		}
		const match: SimMatch = {
			...base,
			teams,
			bestOf,
			score,
			origin,
			round,
			draw,
		};
		result.matches.push(match);
		return match;
	}
	const winner = (m: SimMatch | undefined) =>
		m?.score ? m.teams[m.score[0] > m.score[1] ? 0 : 1] : null;
	const loser = (m: SimMatch | undefined) =>
		m?.score ? m.teams[m.score[0] > m.score[1] ? 1 : 0] : null;
	const p = phase("playin");
	const pm: SimMatch[] = [];
	const add = (index: number, teams: Match["teams"], label: string) => {
		const base = p[index];
		if (base) pm.push(resolve(base, teams, 5, label));
	};
	if (!p[0] || !p[1]) return { ...result, blocked: "Play-In incompleto." };
	add(0, p[0].teams, "Abertura");
	add(1, p[1].teams, "Abertura");
	add(2, [winner(pm[0]), winner(pm[1])], "Chave superior");
	// The imported lower opening may use the reverse team order.
	const lower: Match["teams"] = [loser(pm[0]), loser(pm[1])];
	if (p[3]?.teams[0] === lower[1]) lower.reverse();
	add(3, lower, "Eliminação");
	add(4, [loser(pm[2]), winner(pm[3])], "Final inferior");
	add(5, [winner(pm[2]), winner(pm[4])], "Final do Play-In");
	const qualifier = winner(pm[5]);
	if (!qualifier) return result;
	const first = phase("swiss").slice(0, 8);
	const playinIds = new Set(p.slice(0, 2).flatMap((m) => m.teams));
	const oldQualifier = first
		.flatMap((m) => m.teams)
		.find((id) => playinIds.has(id));
	let initial = first.map(
		(m): [string, string] =>
			m.teams.map((id) => (id === oldQualifier ? qualifier : id)) as [
				string,
				string,
			],
	);
	const region = (id: string) =>
		snapshot.teams.find((t) => t.id === id)?.region;
	const firstDrawSeed = scenario.drawSeeds?.["swiss-1"];
	if (
		firstDrawSeed !== undefined ||
		initial.some(([a, b]) => region(a) === region(b))
	) {
		const top = new Set(["GEN", "AL", "TLAW", "G2"]);
		const second = new Set(["LOS", "TSW", "HLE", "BLG"]);
		const third = new Set(["LYON", "MKOI", "T1", "TES"]);
		const tier = (id: string) => {
			const code = snapshot.teams.find((t) => t.id === id)?.code ?? "";
			return top.has(code) ? 1 : second.has(code) ? 2 : third.has(code) ? 3 : 4;
		};
		const draw = pairTeams(
			shuffle(
				initial.flat(),
				firstDrawSeed === undefined ? next : random(firstDrawSeed),
			),
			(a, b) => tier(a) + tier(b) === 5 && region(a) !== region(b),
		);
		if (!draw)
			return {
				...result,
				blocked: "Não foi possível gerar o sorteio inicial.",
			};
		initial = draw;
	}
	const standings = new Map(
		initial.flat().map((id) => [id, { teamId: id, wins: 0, losses: 0 }]),
	);
	const history = new Set<string>();
	result.standings = [...standings.values()];
	const swiss = phase("swiss");
	let offset = 0;
	for (let round = 1; round <= 5; round++) {
		const active = [...standings.values()].filter(
			(t) => t.wins < 3 && t.losses < 3,
		);
		const bases = swiss.slice(offset, offset + active.length / 2);
		let pairs: [string, string][];
		let official = false;
		const drawSeed = scenario.drawSeeds?.[`swiss-${round}` as DrawKey];
		const drawRandom = drawSeed === undefined ? next : random(drawSeed);
		if (round === 1) {
			pairs = initial;
			official =
				drawSeed === undefined &&
				initial.every((t, i) => t.every((id, j) => id === bases[i]?.teams[j]));
		} else {
			const eligible = new Set(active.map((t) => t.teamId));
			const imported = bases.flatMap((m) => m.teams);
			official =
				drawSeed === undefined &&
				imported.length === active.length &&
				new Set(imported).size === active.length &&
				imported.every((id) => id && eligible.has(id)) &&
				bases.every((m) => {
					const [a, b] = m.teams;
					return (
						a &&
						b &&
						standings.get(a)?.wins === standings.get(b)?.wins &&
						!history.has(pairKey(a, b))
					);
				});
			if (official) pairs = bases.map((m) => m.teams as [string, string]);
			else {
				pairs = [];
				for (let wins = 0; wins <= 2; wins++) {
					const pool = active
						.filter((t) => t.wins === wins)
						.map((t) => t.teamId);
					const draw = pairTeams(
						shuffle(pool, drawRandom),
						(a, b) => !history.has(pairKey(a, b)),
					);
					if (!draw)
						return {
							...result,
							blocked: "Não há sorteio válido sem revanche para este cenário.",
						};
					pairs.push(...draw);
				}
			}
		}
		const matches = pairs.map(([a, b], i) => {
			const base = bases[i];
			const standing = standings.get(a);
			if (!base || !standing) throw new Error("Rodada incompleta.");
			return resolve(
				base,
				[a, b],
				standing.wins === 2 || standing.losses === 2 ? 3 : 1,
				`Rodada ${round}`,
				official ? "official" : "simulated",
			);
		});
		offset += matches.length;
		for (const m of matches) {
			const w = winner(m);
			const l = loser(m);
			if (w && l) {
				const ws = standings.get(w);
				const ls = standings.get(l);
				if (ws && ls) {
					ws.wins++;
					ls.losses++;
				}
				history.add(pairKey(w, l));
			}
		}
		if (matches.some((m) => !m.score)) return result;
	}
	const qualified = [...standings.values()].filter((t) => t.wins === 3);
	const qbase = phase("quarter");
	const qids = qbase.flatMap((m) => m.teams);
	const quarterDrawSeed = scenario.drawSeeds?.quarter;
	const quarterRandom =
		quarterDrawSeed === undefined ? next : random(quarterDrawSeed);
	const officialQuarter =
		quarterDrawSeed === undefined &&
		new Set(qids).size === 8 &&
		qids.every((id) => qualified.some((t) => t.teamId === id)) &&
		qbase.every((m) => {
			const a = standings.get(m.teams[0] ?? "");
			const b = standings.get(m.teams[1] ?? "");
			return (
				a &&
				b &&
				(a.losses !== 0 || b.losses === 2) &&
				(b.losses !== 0 || a.losses === 2)
			);
		});
	let quarters: [string, string][];
	if (officialQuarter) quarters = qbase.map((m) => m.teams as [string, string]);
	else {
		const undefeated = shuffle(
			qualified.filter((t) => t.losses === 0).map((t) => t.teamId),
			quarterRandom,
		);
		const low = shuffle(
			qualified.filter((t) => t.losses === 2).map((t) => t.teamId),
			quarterRandom,
		);
		quarters = undefeated.map((id, i) => [id, low[i] ?? ""]);
		const used = new Set(quarters.flat());
		const rest = shuffle(
			qualified.map((t) => t.teamId).filter((id) => !used.has(id)),
			quarterRandom,
		);
		for (let i = 0; i < rest.length; i += 2) {
			const a = rest[i];
			const b = rest[i + 1];
			if (a && b) quarters.push([a, b]);
		}
		quarters = shuffle(quarters, quarterRandom);
	}
	let previous = quarters.map((teams, i) => {
		const base = qbase[i];
		if (!base) throw new Error("Quartas incompletas.");
		return resolve(
			base,
			teams,
			5,
			"Quartas de final",
			officialQuarter ? "official" : "simulated",
		);
	});
	for (const stage of ["semi", "final"] as const) {
		const bases = phase(stage);
		const advanced = previous.map(winner);
		const official =
			advanced.every(Boolean) &&
			new Set(bases.flatMap((m) => m.teams)).size === advanced.length &&
			bases.flatMap((m) => m.teams).every((id) => advanced.includes(id));
		previous = bases.map((base, i) =>
			resolve(
				base,
				official
					? base.teams
					: [advanced[i * 2] ?? null, advanced[i * 2 + 1] ?? null],
				5,
				stage === "semi" ? "Semifinais" : "Final",
				official ? "official" : "simulated",
			),
		);
	}
	result.champion = winner(previous[0]);
	return result;
}

// Keep independent matches in the same round; discard later-round picks even
// when a later draw happens to produce the same pair.
export function setPick(
	snapshot: Snapshot,
	scenario: Scenario,
	matchId: string,
	score: Score | null,
): Scenario {
	const matches = simulate(snapshot, scenario).matches;
	const index = matches.findIndex((m) => m.id === matchId);
	const match = matches[index];
	if (
		!match ||
		match.origin === "real" ||
		!match.teams[0] ||
		!match.teams[1] ||
		(score && !validScore(score, match.bestOf))
	)
		return scenario;
	const order = snapshot.matches.findIndex((m) => m.id === matchId);
	const parallel = new Set(
		matches
			.filter(
				(other) => other.phase === match.phase && other.round === match.round,
			)
			.map((other) => other.id),
	);
	const picks = Object.fromEntries(
		Object.entries(scenario.picks).filter(
			([id]) =>
				id !== matchId &&
				(parallel.has(id) ||
					snapshot.matches.findIndex((m) => m.id === id) < order),
		),
	);
	if (score)
		picks[matchId] = { teams: [match.teams[0], match.teams[1]], score };
	return { ...scenario, picks };
}

export function matchDrawKey(match: SimMatch): DrawKey | null {
	if (match.phase === "quarter") return "quarter";
	if (match.phase !== "swiss") return null;
	const round = Number(match.round.replace("Rodada ", ""));
	return round >= 1 && round <= 5 ? (`swiss-${round}` as DrawKey) : null;
}

export function getDrawTarget(
	simulation: Simulation,
	phase: "swiss" | "quarter",
) {
	const groups = new Map<
		DrawKey,
		{ key: DrawKey; label: string; matches: SimMatch[] }
	>();
	for (const match of simulation.matches.filter(
		(match) => match.phase === phase,
	)) {
		const key = matchDrawKey(match);
		if (!key) continue;
		const group = groups.get(key) ?? { key, label: match.round, matches: [] };
		group.matches.push(match);
		groups.set(key, group);
	}
	const eligible = [...groups.values()].filter((group) =>
		group.matches.every(
			(match) => match.origin !== "real" && match.teams.every(Boolean),
		),
	);
	return (
		eligible.find((group) => group.matches.some((match) => !match.score)) ??
		eligible.at(-1) ??
		null
	);
}

// Redraw one round without changing previous draws or scores. If no alternative
// is found, leave the entire scenario untouched rather than erase its picks.
export function redrawRound(
	snapshot: Snapshot,
	scenario: Scenario,
	key: DrawKey,
	seed: number,
): Scenario {
	if (!Number.isInteger(seed) || seed < 1 || seed > 2147483646) return scenario;
	const simulation = simulate(snapshot, scenario);
	const matches = simulation.matches.filter(
		(match) => matchDrawKey(match) === key,
	);
	if (
		!matches.length ||
		matches.some(
			(match) => match.origin === "real" || !match.teams.every(Boolean),
		)
	)
		return scenario;
	const first = Math.min(
		...matches.map((match) =>
			snapshot.matches.findIndex((base) => base.id === match.id),
		),
	);
	const picks = Object.fromEntries(
		Object.entries(scenario.picks).filter(
			([id]) => snapshot.matches.findIndex((base) => base.id === id) < first,
		),
	);
	const previousKeys = drawKeys.slice(0, drawKeys.indexOf(key));
	const drawSeeds = Object.fromEntries(
		Object.entries(scenario.drawSeeds ?? {}).filter(([draw]) =>
			previousKeys.includes(draw as DrawKey),
		),
	);
	const signature = (round: SimMatch[]) =>
		round
			.map((match) => [...match.teams].sort().join(":"))
			.sort()
			.join("|");
	const original = signature(matches);
	for (let attempt = 0; attempt < 64; attempt++) {
		const updated: Scenario = {
			...scenario,
			picks,
			drawSeeds: {
				...drawSeeds,
				[key]: ((seed - 1 + attempt * 104729) % 2147483646) + 1,
			},
		};
		const result = simulate(snapshot, updated);
		const drawn = result.matches.filter((match) => matchDrawKey(match) === key);
		if (
			!result.blocked &&
			drawn.length === matches.length &&
			signature(drawn) !== original
		)
			return updated;
	}
	return scenario;
}
