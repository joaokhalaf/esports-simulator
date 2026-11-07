import {
	getDrawTarget,
	redrawRound,
	type SimMatch,
	setPick,
	simulate,
} from "@esports-simulator/api/worlds/engine";
import {
	type DrawKey,
	RULES_VERSION,
	type Scenario,
	type Score,
	type Snapshot,
	scenarioSchema,
	validateSnapshot,
} from "@esports-simulator/api/worlds/model";
import seed from "@esports-simulator/api/worlds/seed.json";
import { useQuery } from "@tanstack/react-query";
import {
	ArrowDownToLine,
	ArrowUpRight,
	Check,
	ChevronRight,
	Dices,
	Info,
	LoaderCircle,
	MoreHorizontal,
	RotateCcw,
	ShieldCheck,
	Undo2,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";
import { TournamentBracket } from "./tournament-bracket";
import { TournamentRounds } from "./tournament-rounds";
import { TournamentSidebar } from "./tournament-sidebar";

const DRAFT_KEY = "worlds-2026-draft-v1";
const phases = [
	{ id: "playin", label: "Fase de entrada", detail: "4 equipes · MD5" },
	{ id: "swiss", label: "Fase suíça", detail: "16 equipes · MD1 / MD3" },
	{ id: "knockout", label: "Playoffs", detail: "8 equipes · MD5" },
] as const;
type Phase = (typeof phases)[number]["id"];
type Draft = { snapshot: Snapshot; scenario: Scenario };
function newScenario(mode: Scenario["mode"]): Scenario {
	return {
		name: "Meu cenário",
		mode,
		seed: Math.floor(Math.random() * 2147483646) + 1,
		picks: {},
		rulesVersion: RULES_VERSION,
	};
}
function readDraft(): Draft | null {
	try {
		const text = localStorage.getItem(DRAFT_KEY);
		if (!text) return null;
		const d = JSON.parse(text);
		return {
			snapshot: validateSnapshot(d.snapshot),
			scenario: scenarioSchema.parse(d.scenario),
		};
	} catch {
		return null;
	}
}
const date = (value: string) =>
	new Date(value).toLocaleString("pt-BR", {
		dateStyle: "short",
		timeStyle: "short",
	});

export function WorldsSimulator() {
	const latest = useQuery(orpc.worlds.latest.queryOptions());
	const [draft] = useState(readDraft);
	if (latest.isPending && !draft)
		return (
			<div className="worlds-loading">
				<LoaderCircle className="animate-spin" />
				Preparando o Mundial…
			</div>
		);
	return (
		<Editor
			initial={
				draft ?? {
					snapshot: latest.data?.snapshot ?? validateSnapshot(seed),
					scenario: newScenario("current"),
				}
			}
			latestSnapshot={latest.data?.snapshot}
		/>
	);
}

function Editor({
	initial,
	latestSnapshot,
}: {
	initial: Draft;
	latestSnapshot?: Snapshot;
}) {
	const [snapshot, setSnapshot] = useState(initial.snapshot);
	const [scenario, setScenario] = useState(initial.scenario);
	const currentSnapshot = useRef(snapshot);
	currentSnapshot.current = snapshot;
	const currentScenario = useRef(scenario);
	currentScenario.current = scenario;
	const resetToastId = useId();
	const redrawToast = useRef<string | null>(null);
	const redrawSequence = useRef(0);
	useEffect(
		() => () => {
			toast.dismiss(resetToastId);
			toast.dismiss(`${resetToastId}-draw-status`);
			if (redrawToast.current !== null) toast.dismiss(redrawToast.current);
		},
		[resetToastId],
	);
	const [phase, setPhase] = useState<Phase>("knockout");
	const [history, setHistory] = useState<Scenario[]>([]);
	const [busy, setBusy] = useState(false);
	const [candidate, setCandidate] = useState<Snapshot | null>(null);
	const [localError, setLocalError] = useState(false);
	const simulation = useMemo(
		() => simulate(snapshot, scenario),
		[snapshot, scenario],
	);
	const drawTarget =
		phase === "playin"
			? null
			: getDrawTarget(simulation, phase === "swiss" ? "swiss" : "quarter");
	const teams = new Map(snapshot.teams.map((t) => [t.id, t]));
	const champion = teams.get(simulation.champion ?? "");
	const completed = simulation.matches.filter((m) => m.score).length;
	const simulated = simulation.matches.filter(
		(m) => m.origin === "simulated",
	).length;
	const available = candidate ?? latestSnapshot ?? snapshot;
	const matches = simulation.matches.filter((m) =>
		phase === "knockout"
			? ["quarter", "semi", "final"].includes(m.phase)
			: m.phase === phase,
	);
	const standings = [...simulation.standings].sort(
		(a, b) =>
			b.wins - a.wins ||
			a.losses - b.losses ||
			(teams.get(a.teamId)?.code ?? "").localeCompare(
				teams.get(b.teamId)?.code ?? "",
			),
	);
	useEffect(() => {
		try {
			localStorage.setItem(DRAFT_KEY, JSON.stringify({ snapshot, scenario }));
			setLocalError(false);
		} catch {
			setLocalError(true);
		}
	}, [snapshot, scenario]);
	function start(mode: Scenario["mode"], base = snapshot) {
		if (
			Object.keys(scenario.picks).length &&
			!window.confirm(
				"Criar outra simulação? Seus palpites atuais serão substituídos neste navegador.",
			)
		)
			return;
		setHistory([]);
		setSnapshot(base);
		setScenario(newScenario(mode));
		setPhase(mode === "current" ? "swiss" : "playin");
		setCandidate(null);
	}
	async function refresh() {
		setBusy(true);
		try {
			const imported = await client.worlds.live();
			setCandidate(imported);
			toast.success(
				imported.id === snapshot.id
					? "Você já está usando esta versão dos dados."
					: "Dados importados. Crie um cenário com a nova versão quando quiser.",
			);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Falha ao importar dados.",
			);
		} finally {
			setBusy(false);
		}
	}
	function changePick(match: SimMatch, score: Score | null) {
		const current = currentScenario.current;
		const updated = setPick(snapshot, current, match.id, score);
		if (updated === current) return;
		setHistory((items) => [...items, current]);
		setScenario(updated);
		if (!score) return;
		const progression = simulate(snapshot, updated);
		const round = progression.matches.filter(
			(item) => item.phase === match.phase && item.round === match.round,
		);
		if (!round.every((item) => item.score)) return;
		const next = progression.matches.find(
			(item) => !item.score && item.teams.every(Boolean),
		);
		if (next)
			setPhase(
				next.phase === "playin" || next.phase === "swiss"
					? next.phase
					: "knockout",
			);
	}
	function applyRedraw(key: DrawKey, label: string) {
		const current = currentScenario.current;
		const updated = redrawRound(
			currentSnapshot.current,
			current,
			key,
			Math.floor(Math.random() * 2147483646) + 1,
		);
		if (updated === current) {
			toast.info(
				"Não foi encontrado outro sorteio válido para esta rodada. Tente novamente.",
				{ id: `${resetToastId}-draw-status` },
			);
			return;
		}
		setHistory((items) => [...items, current]);
		setScenario(updated);
		setPhase(key === "quarter" ? "knockout" : "swiss");
		toast.success(`Novo sorteio: ${label}.`, {
			id: `${resetToastId}-draw-status`,
			description: "Rodadas anteriores preservadas.",
		});
	}
	function redraw() {
		if (!drawTarget) return;
		if (redrawToast.current !== null) toast.dismiss(redrawToast.current);
		if (!drawTarget.matches.some((match) => match.score)) {
			applyRedraw(drawTarget.key, drawTarget.label);
			return;
		}
		const toastId = `${resetToastId}-draw-${++redrawSequence.current}`;
		redrawToast.current = toastId;
		toast(`Refazer sorteio: ${drawTarget.label}?`, {
			id: toastId,
			description:
				"Os palpites desta rodada e das próximas serão apagados. As rodadas anteriores serão mantidas.",
			duration: Number.POSITIVE_INFINITY,
			className: "reset-confirmation",
			action: {
				label: "Sortear",
				onClick: () => applyRedraw(drawTarget.key, drawTarget.label),
			},
			cancel: {
				label: "Cancelar",
				onClick: () => {
					toast.dismiss(toastId);
				},
			},
		});
	}
	const playoffMatches: SimMatch[] = snapshot.matches
		.filter((match) => ["quarter", "semi", "final"].includes(match.phase))
		.map(
			(match) =>
				simulation.matches.find((item) => item.id === match.id) ?? {
					...match,
					teams: [null, null],
					score: null,
					origin: null,
					round:
						match.phase === "quarter"
							? "Quartas de final"
							: match.phase === "semi"
								? "Semifinais"
								: "Final",
					draw: "simulated",
				},
		);
	const visibleMatches = phase === "knockout" ? playoffMatches : matches;
	const totalPhaseMatches =
		phase === "knockout"
			? playoffMatches.length
			: snapshot.matches.filter(
					(match) => match.phase === (phase === "swiss" ? "swiss" : "playin"),
				).length;
	const phaseCompleted = visibleMatches.filter((match) => match.score).length;
	function clearPicks() {
		if (!Object.keys(scenario.picks).length) return;
		toast("Reiniciar simulação?", {
			id: resetToastId,
			description:
				"Seus palpites serão apagados. Os resultados reais serão mantidos.",
			duration: Number.POSITIVE_INFINITY,
			className: "reset-confirmation",
			action: {
				label: "Reiniciar",
				onClick: () => {
					const current = currentScenario.current;
					if (!Object.keys(current.picks).length) return;
					setHistory((items) => [...items, current]);
					setScenario({ ...current, picks: {} });
					toast.success("Simulação reiniciada.");
				},
			},
			cancel: {
				label: "Cancelar",
				onClick: () => {
					toast.dismiss(resetToastId);
				},
			},
		});
	}
	function undo() {
		const previous = history.at(-1);
		if (!previous) return;
		setScenario(previous);
		setHistory((items) => items.slice(0, -1));
	}
	function simulateRest(beforePlayoffs = false) {
		let updated = scenario;
		let random = (scenario.seed + Object.keys(scenario.picks).length) >>> 0;
		for (let step = 0; step < 46; step++) {
			const result = simulate(snapshot, updated);
			const match = result.matches.find(
				(item) => !item.score && item.teams.every(Boolean),
			);
			if (
				!match ||
				(beforePlayoffs && ["quarter", "semi", "final"].includes(match.phase))
			)
				break;
			random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
			const target = Math.ceil(match.bestOf / 2);
			const losing = random % target;
			updated = setPick(
				snapshot,
				updated,
				match.id,
				random % 2 ? [target, losing] : [losing, target],
			);
		}
		setHistory((items) => [...items, scenario]);
		setScenario(updated);
	}
	return (
		<div className="lab-layout">
			<main className="worlds-app">
				<section className="tournament-heading">
					<img
						className="worlds-emblem"
						src="https://static.lolesports.com/leagues/1592594612171_WorldsDarkBG.png"
						alt=""
					/>
					<div>
						<div className="tournament-title">
							<h1>Worlds 2026</h1>
						</div>
					</div>
					<span className="demo-badge">
						{snapshot.source === "admin"
							? "Dados ajustados"
							: "Dados importados"}
					</span>
				</section>
				<nav className="phase-tabs" aria-label="Fases do campeonato">
					{phases.map((item) => (
						<button
							type="button"
							key={item.id}
							onClick={() => setPhase(item.id)}
							aria-current={phase === item.id ? "page" : undefined}
							className={phase === item.id ? "active" : ""}
						>
							{item.label}
						</button>
					))}
					<span className="phase-format">
						Formato: <strong>{phase === "swiss" ? "MD1 / MD3" : "MD5"}</strong>
					</span>
				</nav>
				<section
					className="simulation-controls"
					aria-label="Controles da simulação"
				>
					<div className="mode-actions">
						<button
							type="button"
							className={scenario.mode === "beginning" ? "active" : ""}
							aria-pressed={scenario.mode === "beginning"}
							onClick={() => start("beginning")}
						>
							Do início
						</button>
						<button
							type="button"
							className={scenario.mode === "current" ? "active" : ""}
							aria-pressed={scenario.mode === "current"}
							onClick={() => start("current")}
						>
							Situação atual
						</button>
					</div>
					<div className="simulation-actions">
						<span className="scenario-count">
							{phaseCompleted} de {totalPhaseMatches} definidos
						</span>
						<button
							type="button"
							className="clear-button"
							onClick={clearPicks}
							disabled={!Object.keys(scenario.picks).length}
						>
							<RotateCcw size={16} />
							Reiniciar
						</button>
						<button
							type="button"
							className="draw-button"
							onClick={redraw}
							disabled={!drawTarget}
							title={
								drawTarget
									? `Gerar outros confrontos para ${drawTarget.label}`
									: "O sorteio fica disponível quando os participantes de uma rodada sem resultados reais estão definidos."
							}
						>
							<Dices size={17} />
							<span>
								Refazer sorteio{drawTarget && <small>{drawTarget.label}</small>}
							</span>
						</button>
						<button
							type="button"
							className="outline-button"
							onClick={() => simulateRest()}
						>
							Simular restantes
						</button>
						<details className="scenario-options">
							<summary aria-label="Opções do cenário">
								<MoreHorizontal size={19} />
							</summary>
							<div>
								<button type="button" disabled={busy} onClick={refresh}>
									<ArrowDownToLine size={15} />
									Importar da Riot
								</button>
							</div>
						</details>
					</div>
				</section>
				{localError && (
					<p role="alert" className="notice">
						Não foi possível salvar o rascunho neste navegador. Mantenha esta
						página aberta para preservar seus palpites.
					</p>
				)}
				{available.id !== snapshot.id && (
					<div className="notice">
						Há uma nova versão dos dados.{" "}
						<button type="button" onClick={() => start("current", available)}>
							Criar cenário atualizado <ChevronRight size={14} />
						</button>
					</div>
				)}
				{phase === "knockout" ? (
					<>
						<h2 className="sr-only">Playoffs</h2>
						{!playoffMatches.some((match) => match.teams.some(Boolean)) && (
							<div className="qualification-hint">
								<Info size={16} />
								<span>
									Os classificados serão definidos pelos resultados das fases
									anteriores.
								</span>
								<button type="button" onClick={() => simulateRest(true)}>
									Simular fases anteriores <ChevronRight size={14} />
								</button>
							</div>
						)}
						<TournamentBracket
							matches={playoffMatches}
							teams={teams}
							onPick={changePick}
							champion={champion}
						/>
					</>
				) : (
					<>
						<div className={phase === "swiss" ? "sr-only" : "section-heading"}>
							<div>
								<h2>{phase === "playin" ? "Fase de entrada" : "Fase Suíça"}</h2>
								{phase === "playin" && (
									<p>19 equipes. Três fases. Um campeão.</p>
								)}
							</div>
						</div>
						{phase === "playin" && (
							<>
								<div className="overview-stats">
									<div>
										<span>Participantes</span>
										<strong>19 equipes</strong>
									</div>
									<div>
										<span>Séries definidas</span>
										<strong>{completed} / 46</strong>
									</div>
									<div>
										<span>Suas escolhas</span>
										<strong>{simulated} resultados</strong>
									</div>
									<div>
										<span>Campeão</span>
										<strong>{champion?.code ?? "A definir"}</strong>
									</div>
								</div>
								<h3 className="stage-label">
									Fase de Entrada <span>Dupla eliminação · MD5</span>
								</h3>
							</>
						)}
						<div
							className={
								phase === "swiss" ? "swiss-layout" : "overview-matches"
							}
						>
							<div>
								{!matches.length && (
									<div className="empty-stage">
										<ShieldCheck size={30} />
										<h3>Complete o Play-In</h3>
										<p>
											Defina os resultados da Fase de Entrada para conhecer as
											equipes do suíço.
										</p>
										<button
											type="button"
											className="outline-button"
											onClick={() => setPhase("playin")}
										>
											Ir para a fase de entrada
										</button>
									</div>
								)}
								<TournamentRounds
									key={phase}
									kind={phase === "swiss" ? "swiss" : "playin"}
									matches={matches}
									templates={snapshot.matches.filter(
										(match) =>
											match.phase === (phase === "swiss" ? "swiss" : "playin"),
									)}
									teams={teams}
									onPick={changePick}
								/>
							</div>
							{phase === "swiss" && (
								<details className="standings-card">
									<summary>
										<h3>Classificação do suíço</h3>
									</summary>
									<table>
										<thead>
											<tr>
												<th scope="col">Equipe</th>
												<th scope="col">V</th>
												<th scope="col">D</th>
											</tr>
										</thead>
										<tbody>
											{standings.map((standing) => {
												const team = teams.get(standing.teamId);
												return (
													<tr
														key={standing.teamId}
														className={
															standing.wins === 3
																? "qualified"
																: standing.losses === 3
																	? "eliminated"
																	: ""
														}
													>
														<th scope="row">
															{team?.image && <img src={team.image} alt="" />}
															{team?.code}
															{standing.wins === 3 && <Check size={12} />}
														</th>
														<td>{standing.wins}</td>
														<td>{standing.losses}</td>
													</tr>
												);
											})}
										</tbody>
									</table>
									<p>
										Atualizada a cada resultado confirmado. Equipes com o mesmo
										retrospecto estão empatadas.
									</p>
								</details>
							)}
						</div>
						{phase === "playin" && (
							<section className="participants">
								<h3 className="stage-label">Participantes</h3>
								<div>
									{snapshot.teams.map((team) => (
										<span key={team.id}>
											<img src={team.image} alt="" />
											{team.code}
											<small>{team.region.toUpperCase()}</small>
										</span>
									))}
								</div>
							</section>
						)}
					</>
				)}
				{simulation.blocked && (
					<p role="alert" className="notice">
						{simulation.blocked}
					</p>
				)}
				<div className="board-footnote">
					<span>
						<Info size={17} />
						Clique em um time para avançar · Você pode alterar seus palpites.
					</span>
					<button
						type="button"
						className="footer-undo"
						aria-label="Desfazer última alteração"
						disabled={!history.length}
						onClick={undo}
					>
						<Undo2 size={14} />
						Desfazer
					</button>
					<span>
						{scenario.mode === "current"
							? "Resultados reais preservados"
							: "Cenário desde o início"}{" "}
						· {simulated} simulados
					</span>
				</div>
				<div className="source-line">
					<span>
						LoL Esports · Dados importados em {date(snapshot.importedAt)}
					</span>
					<button type="button" disabled={busy} onClick={refresh}>
						{busy ? (
							<LoaderCircle size={13} className="animate-spin" />
						) : (
							<ArrowDownToLine size={13} />
						)}
						Importar da Riot
					</button>
				</div>
				<footer className="worlds-footer">
					Projeto independente, não endossado pela Riot Games. League of Legends
					e suas marcas pertencem à Riot Games.
					<a
						href="https://lolesports.com/en-GB/news/worlds-2026-primer"
						target="_blank"
						rel="noreferrer"
					>
						Formato oficial <ArrowUpRight size={12} />
					</a>
				</footer>
			</main>
			<TournamentSidebar />
		</div>
	);
}
