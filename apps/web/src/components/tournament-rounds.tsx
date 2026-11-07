import type { SimMatch } from "@esports-simulator/api/worlds/engine";
import type { Match, Score, Team } from "@esports-simulator/api/worlds/model";
import {
	type ReactNode,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { RoundNavigation, useRoundNavigation } from "./round-navigation";
import { MatchCard } from "./tournament-bracket";

type RoundGroup = { id: string; label: string; matches: SimMatch[] };
function groupsFor(
	kind: "swiss" | "playin",
	matches: SimMatch[],
	templates: Match[],
): RoundGroup[] {
	const definitions =
		kind === "swiss"
			? [
					{ id: "round-1", label: "Rodada 1", count: 8 },
					{ id: "round-2", label: "Rodada 2", count: 8 },
					{ id: "round-3", label: "Rodada 3", count: 8 },
					{ id: "round-4", label: "Rodada 4", count: 6 },
					{ id: "round-5", label: "Rodada 5", count: 3 },
				]
			: [
					{ id: "opening", label: "Abertura", count: 2 },
					{ id: "upper", label: "Chave superior", count: 1 },
					{ id: "lower", label: "Eliminação", count: 1 },
					{ id: "lower-final", label: "Final inferior", count: 1 },
					{ id: "final", label: "Final do Play-In", count: 1 },
				];
	let offset = 0;
	return definitions.map((definition) => {
		const slice = templates.slice(offset, offset + definition.count);
		offset += definition.count;
		return {
			id: definition.id,
			label: definition.label,
			matches: slice.map(
				(base): SimMatch =>
					matches.find((match) => match.id === base.id) ?? {
						...base,
						teams: [null, null],
						score: null,
						origin: null,
						round: definition.label,
						draw: "simulated",
					},
			),
		};
	});
}

// Campaigns are measured before the round, independently of its results.
const swissRecords = [
	[{ wins: 0, losses: 0, count: 8 }],
	[
		{ wins: 1, losses: 0, count: 4 },
		{ wins: 0, losses: 1, count: 4 },
	],
	[
		{ wins: 2, losses: 0, count: 2 },
		{ wins: 1, losses: 1, count: 4 },
		{ wins: 0, losses: 2, count: 2 },
	],
	[
		{ wins: 2, losses: 1, count: 3 },
		{ wins: 1, losses: 2, count: 3 },
	],
	[{ wins: 2, losses: 2, count: 3 }],
];

function swissPools(groups: RoundGroup[]) {
	const records = new Map<string, { wins: number; losses: number }>();
	return groups.map((group, round) => {
		const pools = (swissRecords[round] ?? []).map((record) => ({
			...record,
			matches: [] as SimMatch[],
			arrivals: [] as string[],
		}));
		// Allocate known opponents by their actual preceding series, never by slot order.
		for (const match of group.matches.filter((match) =>
			match.teams.every(Boolean),
		)) {
			const record = records.get(match.teams[0] ?? "") ?? {
				wins: 0,
				losses: 0,
			};
			const pool = pools.find(
				(pool) => pool.wins === record.wins && pool.losses === record.losses,
			);
			pool?.matches.push(match);
		}
		for (const match of group.matches.filter(
			(match) => !match.teams.every(Boolean),
		)) {
			pools
				.find((pool) => pool.matches.length < pool.count)
				?.matches.push(match);
		}
		for (const pool of pools) {
			const drawn = new Set(pool.matches.flatMap((match) => match.teams));
			pool.arrivals = [...records.entries()]
				.filter(
					([team, record]) =>
						!drawn.has(team) &&
						record.wins + record.losses === round &&
						record.wins === pool.wins &&
						record.losses === pool.losses,
				)
				.map(([team]) => team);
		}
		for (const match of group.matches) {
			for (const [side, team] of match.teams.entries()) {
				if (!team) continue;
				const record = records.get(team) ?? { wins: 0, losses: 0 };
				if (match.score) {
					if (match.score[side] === Math.max(...match.score)) record.wins++;
					else record.losses++;
				}
				records.set(team, record);
			}
		}
		return { ...group, pools };
	});
}

function SwissRound({
	group,
	renderMatch,
	teams,
}: {
	teams: Map<string, Team>;
	group: ReturnType<typeof swissPools>[number];
	renderMatch: (match: SimMatch, index: number) => ReactNode;
}) {
	return (
		<div className="swiss-pools">
			{group.pools.map((pool) => (
				<section
					className="swiss-pool"
					key={`${pool.wins}-${pool.losses}`}
					aria-label={`${group.label}: ${pool.wins} vitórias e ${pool.losses} derrotas`}
					data-record={`${pool.wins}-${pool.losses}`}
				>
					<header className="swiss-pool-heading">
						<h4>{group.label}</h4>
						<span
							className="swiss-record-squares"
							role="img"
							aria-label={`${pool.wins} vitórias, ${pool.losses} derrotas`}
						>
							{Array.from({ length: 4 }, (_, index) => (
								<span
									key={index < pool.wins ? `win-${index}` : `other-${index}`}
									className={
										index < pool.wins
											? "record-win"
											: index < pool.wins + pool.losses
												? "record-loss"
												: "record-empty"
									}
								/>
							))}
						</span>
					</header>
					<div className="swiss-pool-caption">
						<span>{pool.wins === 2 || pool.losses === 2 ? "MD3" : "MD1"}</span>
					</div>
					<div className="round-column-matches">
						{pool.arrivals.length > 0 && (
							<section
								className="swiss-pending-draw"
								aria-label={`Equipes garantidas na ${group.label}`}
							>
								<p>Aguardando sorteio</p>
								{pool.arrivals.map((teamId) => {
									const team = teams.get(teamId);
									return (
										<div className="swiss-advancing-team" key={teamId}>
											{team && <img src={team.image} alt="" />}
											<strong>{team?.code}</strong>
											<span>Adversário a definir</span>
										</div>
									);
								})}
							</section>
						)}
						{pool.matches.map(renderMatch)}
					</div>
				</section>
			))}
		</div>
	);
}

export function TournamentRounds({
	kind,
	matches,
	templates,
	teams,
	onPick,
}: {
	kind: "swiss" | "playin";
	matches: SimMatch[];
	templates: Match[];
	teams: Map<string, Team>;
	onPick: (match: SimMatch, score: Score | null) => void;
}) {
	const id = useId();
	const groups = groupsFor(kind, matches, templates);
	const preferred =
		groups.find((group) =>
			group.matches.some((match) => !match.score && match.teams.every(Boolean)),
		) ??
		groups.find((group) => group.matches.some((match) => !match.score)) ??
		groups.at(-1);
	const navigation = useRoundNavigation(
		preferred?.id ?? "opening",
		kind === "swiss" ? 1072 : 752,
	);
	const swissGroups = kind === "swiss" ? swissPools(groups) : [];
	const selectedSwiss = swissGroups.find(
		(group) => group.id === navigation.active,
	);
	const selected = groups.find((group) => group.id === navigation.active);
	const renderMatch = (match: SimMatch, index: number) => (
		<MatchCard
			key={`${match.id}:${match.teams.join(":")}:${match.score?.join(":")}`}
			compact
			index={index}
			match={match}
			teams={teams}
			onPick={(score) => onPick(match, score)}
		/>
	);
	return (
		<div className="rounds-workspace" ref={navigation.ref}>
			<RoundNavigation
				id={id}
				label={kind === "swiss" ? "Rodadas do suíço" : "Rodadas do Play-In"}
				active={navigation.active}
				onChange={navigation.select}
				items={[
					{
						id: "all",
						label: kind === "swiss" ? "Todas as rodadas" : "Chave completa",
					},
					...groups.map((group) => ({
						id: group.id,
						label: group.label,
						count: `${group.matches.filter((match) => match.score).length}/${group.matches.length}`,
					})),
				]}
			/>
			<div
				className="round-tabpanel"
				id={`${id}-panel`}
				role="tabpanel"
				aria-labelledby={`${id}-${navigation.active}`}
			>
				{navigation.active === "all" ? (
					<div className="rounds-overflow">
						{kind === "swiss" ? (
							<div className="swiss-board">
								{swissGroups.map((group) => (
									<section
										className="round-column"
										key={group.id}
										aria-label={group.label}
									>
										<SwissRound
											group={group}
											renderMatch={renderMatch}
											teams={teams}
										/>
									</section>
								))}
							</div>
						) : (
							<PlayInBracket
								matches={groups.flatMap((group) => group.matches)}
								renderMatch={renderMatch}
							/>
						)}
					</div>
				) : (
					selected && (
						<section className="selected-round">
							<div className="selected-round-heading">
								<h3>{selected.label}</h3>
								<span>
									{selected.matches.filter((match) => match.score).length} de{" "}
									{selected.matches.length} definidos
								</span>
							</div>
							{selectedSwiss ? (
								<SwissRound
									group={selectedSwiss}
									renderMatch={renderMatch}
									teams={teams}
								/>
							) : (
								<div className="round-cards">
									{selected.matches.map(renderMatch)}
								</div>
							)}
							{selected.matches.every(
								(match) => !match.teams.every(Boolean),
							) && (
								<p className="round-waiting">
									Os confrontos serão definidos ao concluir as rodadas
									anteriores.
								</p>
							)}
						</section>
					)
				)}
			</div>
		</div>
	);
}

function PlayInBracket({
	matches,
	renderMatch,
}: {
	matches: SimMatch[];
	renderMatch: (match: SimMatch, index: number) => ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [paths, setPaths] = useState<
		{ id: string; path: string; lower: boolean }[]
	>([]);
	useLayoutEffect(() => {
		const board = ref.current;
		if (!board) return;
		let frame = 0;
		const measure = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const box = board.getBoundingClientRect();
				const connections = [
					{ from: 0, to: 2, lower: false },
					{ from: 1, to: 2, lower: false },
					{ from: 0, to: 3, lower: true },
					{ from: 1, to: 3, lower: true },
					{ from: 2, to: 5, lower: false },
					{ from: 3, to: 4, lower: false },
					{ from: 2, to: 4, lower: true },
					{ from: 4, to: 5, lower: false },
				];
				const next = connections.flatMap((edge) => {
					const a = board
						.querySelector(`[data-slot="${edge.from}"] .match-rows`)
						?.getBoundingClientRect();
					const b = board
						.querySelector(`[data-slot="${edge.to}"] .match-rows`)
						?.getBoundingClientRect();
					if (!a || !b) return [];
					const x = a.right - box.left;
					const y = a.top + a.height / 2 - box.top;
					const endX = b.left - box.left;
					const endY = b.top + b.height / 2 - box.top;
					const middle = endX > x ? (x + endX) / 2 : Math.max(x, endX) + 16;
					return [
						{
							id: `${edge.from}-${edge.to}`,
							path: `M ${x} ${y} H ${middle} V ${endY} H ${endX}`,
							lower: edge.lower,
						},
					];
				});
				setPaths((previous) =>
					JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
				);
			});
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(board);
		for (let index = 0; index < matches.length; index++) {
			const node = board.querySelector(`[data-slot="${index}"] .match-card`);
			if (node) observer.observe(node);
		}
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, [matches]);
	const labels = [
		"Abertura · Série 1",
		"Abertura · Série 2",
		"Final superior",
		"Eliminação",
		"Final inferior",
		"Final do Play-In",
	];
	return (
		<div className="playin-bracket" ref={ref}>
			<span className="playin-band-label upper-label">Chave superior</span>
			<span className="playin-band-label lower-label">Chave inferior</span>
			<svg className="playin-connectors" aria-hidden="true">
				{paths.map((edge) => (
					<path
						key={edge.id}
						d={edge.path}
						className={edge.lower ? "loser-path" : undefined}
					/>
				))}
			</svg>
			{matches.map((match, index) => (
				<section
					key={match.id}
					data-slot={index}
					className={`playin-slot playin-slot-${index}`}
				>
					<h3>{labels[index]}</h3>
					{renderMatch(match, index)}
				</section>
			))}
		</div>
	);
}
