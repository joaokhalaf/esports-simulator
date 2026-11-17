import {
	type BrazilDraft,
	brazilResults,
	brazilSnapshot,
	newBrazilDraft,
	parseBrazilDraft,
	setBrazilScore,
	simulateBrazil,
	simulateBrazilStage,
} from "@esports-simulator/api/vct/brazil";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowUpRight,
	Dices,
	RotateCcw,
	Trophy,
	Undo2,
} from "lucide-react";
import { useState } from "react";
import { MatchCard } from "@/components/tournament-bracket";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/simulacoes/brasil")({
	component: BrazilQualifier,
	head: () => ({
		meta: [{ title: "bracket. · Qualificatório brasileiro VCT 2027" }],
	}),
});

const draftKey = "vct-brazil-2027-draft-v1";
const tabs = [
	{ id: "swiss", label: "Fase suíça" },
	{ id: "playoffs", label: "Playoffs" },
	{ id: "results", label: "Resultados das seletivas" },
	{ id: "teams", label: "Participantes" },
	{ id: "vlr", label: "Partidas · VLR" },
] as const;
const button =
	"inline-flex items-center justify-center gap-2 rounded-lg border border-[#b7c9c0] bg-white px-4 py-2 text-sm font-semibold text-[#144e42] hover:bg-[#e6f2e9] disabled:cursor-not-allowed disabled:opacity-40";

function readDraft() {
	try {
		const raw = localStorage.getItem(draftKey);
		return raw
			? (parseBrazilDraft(JSON.parse(raw)) ?? newBrazilDraft())
			: newBrazilDraft();
	} catch {
		return newBrazilDraft();
	}
}

function BrazilQualifier() {
	const [draft, setDraft] = useState(readDraft);
	const [history, setHistory] = useState<BrazilDraft[]>([]);
	const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("swiss");
	const [storageError, setStorageError] = useState(false);
	const live = useQuery({
		...orpc.vct.brazil.queryOptions(),
		refetchInterval: 60_000,
		staleTime: 30_000,
	});
	const collected = live.data?.snapshot;
	const result = simulateBrazil(draft);
	const phase = tab === "swiss" || tab === "playoffs" ? tab : null;
	const matches = result.matches.filter((match) => match.stage === phase);
	const rounds = [...new Set(matches.map((match) => match.round))];
	const playable = matches.some(
		(match) => !match.score && match.teams.every(Boolean),
	);
	const name = (id: string | null) =>
		id ? (result.teams.get(id)?.name ?? id) : "A definir";

	function save(next: BrazilDraft) {
		setDraft(next);
		try {
			localStorage.setItem(draftKey, JSON.stringify(next));
			setStorageError(false);
		} catch {
			setStorageError(true);
		}
	}
	function apply(next: BrazilDraft) {
		if (next === draft) return;
		setHistory([...history, draft]);
		save(next);
	}
	function undo() {
		const previous = history.at(-1);
		if (!previous) return;
		setHistory(history.slice(0, -1));
		save(previous);
	}

	return (
		<main className="min-h-svh bg-[#f5f7f4] px-4 py-6 text-[#101620] sm:px-8 lg:px-12">
			<div className="mx-auto max-w-7xl">
				<Link
					to="/"
					className="inline-flex items-center gap-2 text-sm font-semibold text-[#144e42] hover:underline"
				>
					<ArrowLeft size={16} aria-hidden="true" /> Voltar ao início
				</Link>
				<header className="mt-7 border-b border-[#dce2e7] pb-7">
					<p className="text-xs font-bold tracking-[0.18em] text-[#144e42] uppercase">
						VALORANT · VCT Americas Kickoff 2027
					</p>
					<h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
						Qualificatório brasileiro
					</h1>
					<p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
						16 equipes. Uma vaga direta no Kickoff. Escolha os placares da fase
						suíça e acompanhe seu caminho até a final brasileira.
					</p>
					<div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
						<span className="rounded-full bg-[#e0eee5] px-3 py-1.5 text-[#144e42]">
							Suíço · 20–22 nov.
						</span>
						<span className="rounded-full bg-white px-3 py-1.5">
							Playoffs · 26–29 nov. e 3–6 dez.
						</span>
						<span className="rounded-full bg-white px-3 py-1.5">
							Dados consultados · {brazilSnapshot.checkedAt}
						</span>
					</div>
				</header>

				<section
					aria-label="Vagas brasileiras"
					className="mt-6 grid gap-3 sm:grid-cols-2"
				>
					{[
						{ label: "Campeão · vaga no Kickoff", team: result.champion },
						{ label: "Vice · disputa o Americas LCQ", team: result.runnerUp },
					].map(({ label, team }) => (
						<div
							key={label}
							className="rounded-xl border border-[#c7d9ce] bg-white p-5"
						>
							<p className="flex items-center gap-2 text-xs font-bold text-[#144e42]">
								<Trophy size={16} aria-hidden="true" />
								{label}
							</p>
							<p className="mt-2 text-xl font-extrabold break-words">
								{name(team)}
							</p>
							{team && (
								<p className="mt-1 text-xs text-slate-500">
									Resultado do seu cenário
								</p>
							)}
						</div>
					))}
				</section>

				<nav
					aria-label="Etapas do qualificatório brasileiro"
					className="mt-7 flex flex-wrap gap-2"
				>
					{tabs.map((item) => (
						<button
							key={item.id}
							type="button"
							onClick={() => setTab(item.id)}
							aria-pressed={tab === item.id}
							className={`${button} aria-pressed:border-[#144e42] aria-pressed:bg-[#144e42] aria-pressed:text-white`}
						>
							{item.label}
						</button>
					))}
				</nav>

				{phase && (
					<>
						<div className="mt-5 flex flex-wrap items-start justify-between gap-4 border-y border-[#dce2e7] py-5">
							<div>
								<h2 className="text-xl font-bold">
									{phase === "swiss"
										? "Fase suíça"
										: "Playoffs de dupla eliminação"}
								</h2>
								<p className="mt-1 max-w-xl text-sm text-slate-600">
									{phase === "swiss"
										? "Duas vitórias classificam; duas derrotas eliminam. Séries MD3."
										: "Oito classificados disputam as chaves superior e inferior. O vice segue para o LCQ, fora desta simulação."}
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<button
									type="button"
									className={button}
									disabled={!history.length}
									onClick={undo}
								>
									<Undo2 size={15} aria-hidden="true" />
									Desfazer
								</button>
								<button
									type="button"
									className={button}
									disabled={!playable}
									onClick={() => apply(simulateBrazilStage(draft, phase))}
								>
									<Dices size={15} aria-hidden="true" />
									Simular etapa
								</button>
								<button
									type="button"
									className={button}
									disabled={!Object.keys(draft.picks).length}
									onClick={() => apply(newBrazilDraft())}
								>
									<RotateCcw size={15} aria-hidden="true" />
									Reiniciar simulação
								</button>
							</div>
						</div>
						<p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
							Pareamentos e seeds deste cenário são simulados, não representam o
							sorteio oficial. Os resultados das seletivas ficam preservados. A
							coleta do VLR fica na aba Partidas · VLR e não altera este
							cenário.
						</p>
						{storageError && (
							<p role="alert" className="mt-3 text-sm text-red-800">
								Não foi possível salvar no navegador. Seus palpites continuam
								disponíveis nesta sessão.
							</p>
						)}
						{phase === "playoffs" && result.qualified.length !== 8 && (
							<p className="mt-5 rounded-lg bg-white p-4 text-sm">
								Complete a fase suíça para definir os oito participantes dos
								playoffs.
							</p>
						)}
						<div className="mt-6 grid items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
							{rounds.map((round) => (
								<section key={round} aria-label={round} className="min-w-0">
									<h3 className="mb-3 text-sm font-bold">{round}</h3>
									<div className="space-y-3">
										{matches
											.filter((match) => match.round === round)
											.map((match) => (
												<MatchCard
													key={`${match.id}:${match.teams.join(":")}`}
													match={match}
													teams={result.teams}
													onPick={(score) =>
														apply(setBrazilScore(draft, match.id, score))
													}
												/>
											))}
									</div>
								</section>
							))}
						</div>
						{phase === "swiss" && (
							<section
								className="mt-7 overflow-x-auto rounded-xl border border-[#dce2e7] bg-white p-4"
								aria-label="Classificação brasileira"
							>
								<h2 className="mb-3 text-lg font-bold">
									Classificação · {result.qualified.length}/8 nos playoffs
								</h2>
								<table className="w-full text-left text-sm">
									<thead>
										<tr>
											<th className="py-2">Equipe</th>
											<th>V</th>
											<th>D</th>
											<th>Situação</th>
										</tr>
									</thead>
									<tbody>
										{result.standings.map((team) => (
											<tr key={team.team} className="border-t border-[#edf0ed]">
												<th className="py-2 pr-3 font-medium">
													{name(team.team)}
												</th>
												<td>{team.wins}</td>
												<td>{team.losses}</td>
												<td className="text-xs">
													{team.wins === 2
														? "Classificada"
														: team.losses === 2
															? "Eliminada"
															: "Em disputa"}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</section>
						)}
					</>
				)}

				{tab === "results" && (
					<section className="mt-6" aria-label="Resultados reais das seletivas">
						<h2 className="text-xl font-bold">
							Resultados reais · seletivas encerradas
						</h2>
						<p className="mt-2 text-sm text-slate-600">
							Recorte confirmado das séries decisivas; não é a chave completa
							das seletivas. Piranhas do Caribe também avançou pela repescagem
							da seletiva 1 por W.O., sem placar de mapas atribuído.
						</p>
						<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{brazilResults.map((match) => (
								<article
									key={match.id}
									aria-label={`${match.stage}: ${match.teams.join(" contra ")}`}
									className="rounded-xl border border-[#dce2e7] bg-white p-4"
								>
									<p className="text-xs font-bold text-[#144e42]">
										{match.stage} · {match.label}
									</p>
									<p className="mt-3 text-sm font-bold">
										{match.teams[0]}{" "}
										<span className="font-normal text-slate-400">×</span>{" "}
										{match.teams[1]}
									</p>
									<p className="mt-2 font-bold">
										{match.outcome.kind === "played"
											? match.outcome.score.join(" – ")
											: `W.O. · ${match.outcome.winner} avança`}
									</p>
									<p className="mt-2 text-xs text-slate-500">
										Resultado real · não editável
									</p>
								</article>
							))}
						</div>
					</section>
				)}

				{tab === "teams" && (
					<section className="mt-6" aria-label="Participantes brasileiros">
						<h2 className="text-xl font-bold">
							16 participantes da fase suíça
						</h2>
						<p className="mt-2 text-sm text-slate-600">
							Seis pela primeira seletiva, quatro pela segunda e seis
							convidados. A ordem desta lista não é o seed oficial.
						</p>
						<div className="mt-5 grid gap-4 md:grid-cols-3">
							{[
								{
									label: "Seletiva 1 · 6 classificados",
									names: brazilSnapshot.open1,
								},
								{
									label: "Seletiva 2 · 4 classificados",
									names: brazilSnapshot.open2,
								},
								{ label: "6 convidados", names: brazilSnapshot.invited },
							].map((group) => (
								<div
									key={group.label}
									className="rounded-xl border border-[#dce2e7] bg-white p-5"
								>
									<h3 className="text-sm font-bold text-[#144e42]">
										{group.label}
									</h3>
									<ul className="mt-3 space-y-2 text-sm">
										{group.names.map((team) => (
											<li key={team}>{team}</li>
										))}
									</ul>
								</div>
							))}
						</div>
					</section>
				)}

				{tab === "vlr" && (
					<section className="mt-6" aria-label="Partidas coletadas do VLR">
						<h2 className="text-xl font-bold">Partidas brasileiras · VLR</h2>
						<p className="mt-2 text-sm text-slate-600">
							Consulta periódica ao VLR, sem alterar seus palpites ou os
							pareamentos simulados. Placares parciais não são resultados
							finais.
						</p>
						{live.isPending && (
							<p className="mt-4" role="status">
								Carregando resultados…
							</p>
						)}
						{(live.isError || live.data?.storageAvailable === false) && (
							<p className="mt-4" role="status">
								Coleta indisponível. A base curada e sua simulação continuam
								disponíveis.
							</p>
						)}
						{!live.isPending && !collected && (
							<p className="mt-4">
								Ainda não há coleta publicada. Consulte os resultados
								confirmados das seletivas.
							</p>
						)}
						{collected && (
							<>
								<p className="mt-3 text-sm">
									Última coleta válida:{" "}
									<time dateTime={collected.collectedAt}>
										{new Date(collected.collectedAt).toLocaleString("pt-BR")}
									</time>
									. {collected.matches.length} partidas.
								</p>
								{Date.now() - Date.parse(collected.collectedAt) >
									15 * 60_000 && (
									<p className="mt-2 text-sm text-amber-800">
										Dados podem estar desatualizados; última versão válida
										preservada.
									</p>
								)}
								{collected.events.find((e) => e.id === 3183)?.count === 0 && (
									<p className="mt-3 text-sm">
										O VLR ainda não publicou partidas da fase suíça/playoffs.
									</p>
								)}
								<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{collected.matches.map((match) => (
										<article
											key={match.id}
											className="rounded-xl border border-[#dce2e7] bg-white p-4"
											aria-label={`VLR: ${match.teams.join(" contra ")}`}
										>
											<p className="text-xs font-bold text-[#144e42]">
												{match.stage} · {match.round}
											</p>
											<p className="mt-3 text-sm font-bold">
												{match.teams.join(" × ")}
											</p>
											<p className="mt-2 text-xs">
												{match.status === "live"
													? "Em andamento · placar parcial"
													: match.status === "upcoming"
														? "Agendada"
														: "Encerrada segundo o VLR"}
											</p>
											<p className="mt-2 font-bold">
												{match.outcome.kind === "reported-score"
													? match.outcome.score.join(" – ")
													: match.outcome.kind === "forfeit"
														? `W.O. · ${match.teams[match.outcome.winner]}`
														: "Placar não informado"}
											</p>
											<a
												className="mt-3 inline-block text-sm text-[#144e42] underline"
												href={match.url}
											>
												Conferir no VLR
											</a>
										</article>
									))}
								</div>
							</>
						)}
					</section>
				)}

				<footer className="mt-10 border-t border-[#dce2e7] pt-5 text-xs leading-5 text-slate-500">
					<p>
						Base curada consultada em {brazilSnapshot.checkedAt}. A aba Partidas
						· VLR tem coleta periódica independente. Resultados reais,
						participantes e cenários são apresentados separadamente.
					</p>
					<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
						{brazilSnapshot.sources.map((source) => (
							<a
								key={source.url}
								href={source.url}
								className="inline-flex items-center gap-1 font-semibold text-[#144e42] underline"
							>
								{source.label}
								<ArrowUpRight size={12} aria-hidden="true" />
							</a>
						))}
					</div>
				</footer>
			</div>
		</main>
	);
}
