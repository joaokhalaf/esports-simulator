import type { SimMatch } from "@esports-simulator/api/worlds/engine";
import type { Score, Team } from "@esports-simulator/api/worlds/model";
import { ArrowRight, CircleCheck, Shield, Trophy } from "lucide-react";
import { useId, useState } from "react";
import { RoundNavigation, useRoundNavigation } from "./round-navigation";

const regions: Record<string, string> = {
	kr: "Coreia",
	cn: "China",
	emea: "Europa",
	na: "América do Norte",
	pac: "Ásia-Pacífico",
	br: "Brasil",
};

export function MatchCard({
	match,
	teams,
	onPick,
	compact = false,
	index,
	placeholders,
}: {
	match: SimMatch;
	teams: Map<string, Team>;
	onPick: (score: Score | null) => void;
	compact?: boolean;
	index?: number;
	placeholders?: [string, string];
}) {
	const target = Math.ceil(match.bestOf / 2);
	const ready = match.teams.every(Boolean);
	const locked = match.origin === "real";
	const [side, setSide] = useState<0 | 1 | null>(null);
	const [loserScore, setLoserScore] = useState(
		match.score ? Math.min(...match.score) : 0,
	);
	const [editing, setEditing] = useState(false);
	const winner = match.score ? (match.score[0] > match.score[1] ? 0 : 1) : null;
	function choose(index: 0 | 1) {
		setSide(index);
		setEditing(true);
	}
	function confirm() {
		if (side === null) return;
		onPick(side === 0 ? [target, loserScore] : [loserScore, target]);
		setEditing(false);
		setSide(null);
	}
	return (
		<article
			className={`match-card ${match.origin === "simulated" ? "is-simulated" : ""} ${editing ? "is-editing" : ""} ${compact ? "compact-match" : ""}`}
			aria-label={`Confronto ${teams.get(match.teams[0] ?? "")?.code ?? "a definir"} contra ${teams.get(match.teams[1] ?? "")?.code ?? "a definir"}`}
		>
			{editing && (
				<p className="pick-prompt">
					{compact && index !== undefined
						? `Confronto ${String(index + 1).padStart(2, "0")}`
						: "Escolha quem avança"}
				</p>
			)}
			<div className="match-rows">
				{([0, 1] as const).map((index) => {
					const team = teams.get(match.teams[index] ?? "");
					const selected = editing ? side === index : winner === index;
					return (
						<button
							type="button"
							key={index === 0 ? "home" : "away"}
							className={`team-choice ${selected ? "chosen" : ""}`}
							disabled={!ready || locked}
							onClick={() => choose(index)}
							aria-label={`Escolher ${team?.code ?? "equipe a definir"}`}
							aria-pressed={selected}
						>
							<span
								className={`team-logo ${team && ["G2", "DK", "TSW"].includes(team.code) ? "logo-monochrome" : ""}`}
							>
								{team ? (
									<>
										<span className="team-monogram">
											{team.code.slice(0, 2)}
										</span>
										<img
											src={team.image}
											alt=""
											onError={(e) => {
												e.currentTarget.style.display = "none";
												e.currentTarget.parentElement?.classList.add(
													"logo-failed",
												);
											}}
										/>
									</>
								) : (
									<Shield size={26} strokeWidth={1.3} />
								)}
							</span>
							<span className="team-details" title={team?.name}>
								<span className="team-code">
									{team?.code ?? placeholders?.[index] ?? "A definir"}
								</span>
								{team && (
									<small className="team-region">
										{regions[team.region] ?? team.region}
									</small>
								)}
							</span>
							{editing && (
								<span
									className={`pick-indicator ${selected ? "selected" : ""}`}
									aria-hidden="true"
								/>
							)}
							{winner === index && !editing && (
								<CircleCheck size={16} className="winner-check" />
							)}
							<strong className="match-score">
								{match.score?.[index] ?? "-"}
							</strong>
						</button>
					);
				})}
			</div>
			{editing && (
				<div className="score-editor">
					<fieldset className="score-options" aria-label="Placar da série">
						{[0, 1, 2]
							.filter((score) => score < target)
							.map((score) => (
								<button
									type="button"
									key={`score-${target}-${score}`}
									className={loserScore === score ? "selected" : ""}
									aria-pressed={loserScore === score}
									onClick={() => setLoserScore(score)}
								>
									{target} - {score}
								</button>
							))}
					</fieldset>
					<button type="button" className="confirm-pick" onClick={confirm}>
						Confirmar
						<ArrowRight size={14} />
					</button>
					<button
						type="button"
						className="cancel-pick"
						onClick={() => {
							setEditing(false);
							setSide(null);
						}}
					>
						Cancelar
					</button>
				</div>
			)}
			{!editing && (
				<span className="match-state">
					{locked
						? "Resultado real"
						: match.score
							? "Definido"
							: ready
								? "Clique em uma equipe"
								: "Aguardando classificação"}
				</span>
			)}
		</article>
	);
}

export function TournamentBracket({
	matches,
	teams,
	onPick,
	champion,
}: {
	matches: SimMatch[];
	teams: Map<string, Team>;
	onPick: (match: SimMatch, score: Score | null) => void;
	champion?: Team;
}) {
	const columns = [
		{ phase: "quarter", name: "Quartas de final" },
		{ phase: "semi", name: "Semifinais" },
		{ phase: "final", name: "Grande final" },
	] as const;
	const id = useId();
	const preferred =
		matches.find((match) => !match.score && match.teams.every(Boolean))
			?.phase ??
		matches.find((match) => !match.score)?.phase ??
		"final";
	const navigation = useRoundNavigation(preferred, 744);
	return (
		<div className="bracket-workspace" ref={navigation.ref}>
			<RoundNavigation
				id={id}
				label="Rodadas dos playoffs"
				active={navigation.active}
				onChange={navigation.select}
				items={[
					{ id: "all", label: "Chave completa" },
					...columns.map((column) => ({
						id: column.phase,
						label: column.name,
						count: `${matches.filter((match) => match.phase === column.phase && match.score).length}/${matches.filter((match) => match.phase === column.phase).length}`,
					})),
				]}
			/>
			<section
				className="bracket-scroll"
				aria-label="Chave dos playoffs"
				id={`${id}-panel`}
				role="tabpanel"
				aria-labelledby={`${id}-${navigation.active}`}
			>
				<div
					className={`bracket-board ${navigation.active === "all" ? "" : "is-focused"}`}
				>
					{columns
						.filter(
							(column) =>
								navigation.active === "all" ||
								navigation.active === column.phase,
						)
						.map((column) => (
							<section
								className={`bracket-stage stage-${column.phase}`}
								key={column.phase}
							>
								<div className="bracket-stage-heading">
									<h2>
										<span className="stage-index">
											{String(columns.indexOf(column) + 1).padStart(2, "0")}
										</span>
										{column.name}
									</h2>
									{column.phase !== "final" && <span>MD5</span>}
								</div>
								<div className="bracket-stage-matches">
									{column.phase === "final" && (
										<div className="champion-heading">
											<Trophy size={30} strokeWidth={1.1} />
											<span>
												{champion
													? `${champion.code} · Seu campeão`
													: "Seu campeão"}
											</span>
										</div>
									)}
									{matches
										.filter((match) => match.phase === column.phase)
										.map((match, index) => (
											<div className="bracket-slot" key={match.id}>
												<MatchCard
													key={`${match.id}:${match.teams.join(":")}:${match.score?.join(":")}`}
													compact
													index={index}
													placeholders={
														column.phase === "semi"
															? ([0, 1].map((side) => {
																	const source = matches.filter(
																		(item) => item.phase === "quarter",
																	)[index * 2 + side];
																	const codes = source?.teams
																		.map((id) => teams.get(id ?? "")?.code)
																		.filter(Boolean);
																	return codes?.length === 2
																		? `Vencedor ${codes.join(" / ")}`
																		: "A definir";
																}) as [string, string])
															: undefined
													}
													match={match}
													teams={teams}
													onPick={(score) => onPick(match, score)}
												/>
											</div>
										))}
								</div>
								{navigation.active === "all" && column.phase !== "final" && (
									<svg
										className="bracket-connectors"
										viewBox="0 0 64 472"
										preserveAspectRatio="none"
										aria-hidden="true"
									>
										{column.phase === "quarter" ? (
											<path d="M0 43 H32 V102 H64 M0 161 H32 V102 M0 279 H32 V338 H64 M0 397 H32 V338" />
										) : (
											<path d="M0 102 H32 V220 H64 M0 338 H32 V220" />
										)}
									</svg>
								)}
							</section>
						))}
				</div>
			</section>
		</div>
	);
}
