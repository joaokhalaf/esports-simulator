import {
	type AmericasDraft,
	type AmericasRegion,
	americasRegionIds,
	americasRegions,
	americasTeams,
	applyAmericasPublished,
	newAmericasDraft,
	parseAmericasDraft,
	type QualifierMatch,
	type QualifierStage,
	simulateAmericas,
	validRosters,
} from "@esports-simulator/api/vct/americas";
import {
	americasPublished,
	americasSnapshotDate,
} from "@esports-simulator/api/vct/published";
import type { Score } from "@esports-simulator/api/worlds/model";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Dices, Trophy, Undo2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { MatchCard } from "@/components/tournament-bracket";

export const Route = createFileRoute("/simulacoes/americas")({
	component: AmericasSimulator,
	head: () => ({
		meta: [{ title: "bracket. · Classificatórias VCT Americas 2027" }],
	}),
});

const draftKey = "vct-americas-kickoff-qualifiers-2027-v1";
const stages = [
	{ id: "open1", name: "Seletiva 1" },
	{ id: "open2", name: "Seletiva 2" },
	{ id: "swiss", name: "Fase suíça" },
	{ id: "playoffs", name: "Playoffs" },
] as const;
const slots = [
	{ id: "br", label: "Brasil" },
	{ id: "na", label: "América do Norte" },
	{ id: "latam", label: "LATAM" },
	{ id: "lcq", label: "Última vaga · LCQ" },
] as const;

const pill =
	"rounded-md border border-[#b7c9c0] bg-white px-3 py-2 text-sm font-semibold text-[#144e42] hover:bg-[#e6f2e9] aria-pressed:border-[#144e42] aria-pressed:bg-[#144e42] aria-pressed:text-white disabled:opacity-40";

function publishedDraft() {
	return americasRegionIds.reduce(
		(draft, region) => applyAmericasPublished(draft, region),
		newAmericasDraft(),
	);
}

function readDraft() {
	try {
		const raw = localStorage.getItem(draftKey);
		return (raw && parseAmericasDraft(JSON.parse(raw))) || publishedDraft();
	} catch {
		return publishedDraft();
	}
}

function randomScore(match: QualifierMatch): Score {
	const target = Math.ceil(match.bestOf / 2);
	const other = Math.floor(Math.random() * target);
	return Math.random() < 0.5 ? [target, other] : [other, target];
}

function AmericasSimulator() {
	const [draft, setDraft] = useState(readDraft);
	const [history, setHistory] = useState<AmericasDraft[]>([]);
	const [region, setRegion] = useState<AmericasRegion | "finals">("br");
	const [stage, setStage] = useState<QualifierStage>("open1");
	const [storageError, setStorageError] = useState(false);
	const simulation = useMemo(() => simulateAmericas(draft), [draft]);
	const teams = useMemo(() => americasTeams(draft), [draft]);

	useEffect(() => {
		try {
			localStorage.setItem(draftKey, JSON.stringify(draft));
			setStorageError(false);
		} catch {
			setStorageError(true);
		}
	}, [draft]);

	const visible = simulation.matches.filter(
		(match) =>
			match.region === region && (region === "finals" || match.stage === stage),
	);
	const rounds = [...new Set(visible.map((match) => match.round))];
	const config = region === "finals" ? null : americasRegions[region];
	const stageInfo = stages.find((item) => item.id === stage) ?? stages[0];
	const published =
		region !== "finals" && draft.publishedRegions?.includes(region);
	const data = region === "finals" ? null : americasPublished[region];
	const date = config?.dates[stages.indexOf(stageInfo)];
	const playable = visible.some(
		(match) => !match.score && match.teams.every(Boolean),
	);

	function apply(next: AmericasDraft) {
		const updated = simulateAmericas(next);
		setHistory((items) => [...items, draft]);
		setDraft({
			...next,
			picks: updated.picks,
			lcqEliminated: updated.lcqEliminated,
		});
	}

	function setScore(match: QualifierMatch, score: Score | null) {
		const [a, b] = match.teams;
		if (!a || !b || match.origin === "real") return;
		const picks = { ...draft.picks };
		if (score) picks[match.id] = { teams: [a, b], score };
		else delete picks[match.id];
		const lcqGroupChanged =
			match.stage === "lcq" && match.round === "Todos contra todos";
		apply({
			...draft,
			picks,
			lcqEliminated: lcqGroupChanged ? undefined : draft.lcqEliminated,
		});
	}

	function simulateStage() {
		const result = simulateAmericas(draft, (match) =>
			match.region === region && (region === "finals" || match.stage === stage)
				? randomScore(match)
				: undefined,
		);
		apply({
			...draft,
			picks: result.picks,
			lcqEliminated: result.lcqEliminated,
		});
	}

	function undo() {
		const previous = history.at(-1);
		if (!previous) return;
		setDraft(previous);
		setHistory((items) => items.slice(0, -1));
	}

	function chooseRegion(next: AmericasRegion | "finals") {
		setRegion(next);
		setStage("open1");
	}

	const teamNames = (ids: string[]) =>
		ids.map((id) => teams.get(id)?.name ?? id).join(", ");

	return (
		<main className="min-h-svh bg-[#f5f7f4] px-5 py-7 text-[#101620] sm:px-10 sm:py-10">
			<div className="mx-auto max-w-6xl">
				<nav
					aria-label="Navegação do simulador"
					className="flex flex-wrap gap-5 text-sm font-semibold text-[#144e42]"
				>
					<Link
						to="/"
						className="inline-flex items-center gap-2 hover:underline"
					>
						<ArrowLeft size={16} aria-hidden="true" /> Worlds 2026
					</Link>
					<Link
						to="/calendario"
						search={{ game: "valorant" }}
						className="hover:underline"
					>
						Calendário de Valorant
					</Link>
				</nav>
				<header className="my-7">
					<p className="mb-2 text-xs font-bold tracking-widest text-[#144e42] uppercase">
						Valorant · Seletivas de novembro e dezembro de 2026
					</p>
					<h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
						Classificatórias VCT Americas 2027
					</h1>
					<p className="mt-3 max-w-3xl text-sm text-slate-600">
						Simule as quatro regiões e descubra quem conquista as vagas para o
						Kickoff. Parta dos classificados publicados ou crie um cenário com
						equipes editáveis. Vagas ainda indefinidas aparecem como equipes a
						confirmar.
					</p>
				</header>

				<section
					aria-label="Vagas no Kickoff"
					className="grid grid-cols-2 gap-2 rounded-2xl bg-[#144e42] p-4 text-white sm:grid-cols-4 sm:p-5"
				>
					{slots.map(({ id, label }) => {
						const team = simulation.qualifiers[id];
						return (
							<div
								key={id}
								className="min-w-0 rounded-lg bg-white/10 px-3 py-2"
							>
								<p className="flex items-center gap-1.5 text-xs text-[#d5e9d9]">
									<Trophy size={14} aria-hidden="true" /> {label}
								</p>
								<p className="mt-1 text-sm font-bold wrap-break-word">
									{team ? teams.get(team)?.name : "A definir"}
								</p>
							</div>
						);
					})}
				</section>

				<nav
					aria-label="Regiões da classificatória"
					className="mt-6 flex flex-wrap gap-2"
				>
					{americasRegionIds.map((id) => (
						<button
							className={pill}
							key={id}
							type="button"
							aria-pressed={region === id}
							onClick={() => chooseRegion(id)}
						>
							{americasRegions[id].name}
						</button>
					))}
					<button
						className={pill}
						type="button"
						aria-pressed={region === "finals"}
						onClick={() => chooseRegion("finals")}
					>
						Final LATAM e LCQ
					</button>
				</nav>

				{region !== "finals" && config && (
					<>
						{data && (
							<section
								aria-label="Dados publicados"
								className="mt-4 space-y-3 rounded-xl border border-[#b7c9c0] bg-white p-4 text-sm"
							>
								<h2 className="font-bold">
									Dados consultados em {americasSnapshotDate}
								</h2>
								<p>{data.note}</p>
								<p className="text-slate-600">
									Atualização manual, sem sincronização ao vivo. A seletiva 2
									contém equipes a confirmar; o sorteio e os confrontos futuros
									são simulados.
								</p>
								<p>
									<strong>Classificados da seletiva 1:</strong>{" "}
									{data.qualified.join(", ")}
								</p>
								{published && (
									<p>
										<strong>Convidados / vagas pendentes:</strong>{" "}
										{data.invited.join(", ")}
									</p>
								)}
								<div className="flex flex-wrap gap-4">
									{data.sources.map((source) => (
										<a
											key={source.url}
											href={source.url}
											className="font-semibold text-[#144e42] underline"
										>
											{source.label}
										</a>
									))}
								</div>
								{published ? (
									<button
										className={pill}
										type="button"
										onClick={() =>
											apply({
												...draft,
												rosters: {
													...draft.rosters,
													[region]: newAmericasDraft().rosters[region],
												},
												publishedRegions: draft.publishedRegions?.filter(
													(id) => id !== region,
												),
											})
										}
									>
										Criar cenário com equipes de exemplo
									</button>
								) : (
									<button
										className={pill}
										type="button"
										onClick={() => apply(applyAmericasPublished(draft, region))}
									>
										Usar dados publicados desta região
									</button>
								)}
								<p className="text-xs text-slate-600">
									Trocar a base altera as equipes desta região e descarta
									somente palpites incompatíveis. Use Desfazer para voltar.
								</p>
							</section>
						)}
						{!published && (
							<RosterForm
								key={region + JSON.stringify(draft.rosters[region])}
								region={region}
								roster={draft.rosters[region]}
								onSave={(roster) =>
									apply({
										...draft,
										rosters: { ...draft.rosters, [region]: roster },
									})
								}
							/>
						)}
						<nav
							aria-label="Fases da região"
							className="mt-5 flex flex-wrap gap-2"
						>
							{stages.map(({ id, name }) => (
								<button
									className={pill}
									key={id}
									type="button"
									aria-pressed={stage === id}
									onClick={() => setStage(id)}
								>
									{name}
								</button>
							))}
						</nav>
					</>
				)}

				<section
					aria-label="Controles da classificatória"
					className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-[#dce2e7] py-4"
				>
					<div>
						<h2 className="text-xl font-bold">
							{config
								? `${stageInfo.name} · ${config.name}`
								: "Decisões das Américas"}
						</h2>
						<p className="mt-1 text-sm text-slate-600">
							{date ?? "Final LATAM em 16 dez. · LCQ em 17–18 dez."}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<button
							className={pill}
							type="button"
							disabled={!history.length}
							onClick={undo}
						>
							<Undo2 className="mr-1 inline" size={16} aria-hidden="true" />{" "}
							Desfazer
						</button>
						<button
							className={pill}
							type="button"
							disabled={!playable}
							onClick={simulateStage}
						>
							<Dices className="mr-1 inline" size={16} aria-hidden="true" />{" "}
							Simular etapa
						</button>
					</div>
				</section>
				{storageError && (
					<p role="alert" className="mt-3 text-sm text-red-800">
						O navegador não conseguiu salvar os palpites.
					</p>
				)}

				{region !== "finals" && (
					<div className="mt-4 space-y-2 text-sm text-slate-600">
						{stage === "open1" && (
							<p>
								Séries em MD3.{" "}
								{published ? data?.qualified.length : config?.openSpots}{" "}
								classificados na fase suíça.
							</p>
						)}
						{stage === "open2" && (
							<p>
								{simulation.regions[region].open2Short
									? "Adicione mais equipes à Seletiva 2. As que avançaram pela Seletiva 1 já estão classificadas."
									: "Eliminação simples em MD3. A Seletiva 2 libera quando a Seletiva 1 termina."}
							</p>
						)}
						{stage === "swiss" && (
							<p>
								Duas vitórias classificam, duas derrotas eliminam. Complete as
								duas seletivas para montar a primeira rodada.
							</p>
						)}
						{stage === "playoffs" && (
							<p>
								Chaves superior e inferior. O campeão regional avança e os vices
								de Brasil e América do Norte vão ao LCQ.
							</p>
						)}
						{(stage === "open1" || stage === "open2") &&
							simulation.regions[region][stage].length > 0 && (
								<p className="font-semibold text-[#144e42]">
									Na fase suíça: {teamNames(simulation.regions[region][stage])}
								</p>
							)}
						{stage === "swiss" &&
							simulation.regions[region].standings.length > 0 && (
								<Standings
									standings={simulation.regions[region].standings}
									teams={teams}
								/>
							)}
					</div>
				)}
				{region === "finals" && (
					<div className="mt-4 space-y-3 text-sm text-slate-600">
						<p>
							A final LATAM é em MD5. Os vices de Brasil, América do Norte e
							LATAM jogam entre si em MD3 no LCQ. Os dois melhores disputam a
							última vaga em MD5.
						</p>
						{simulation.lcqStandings.length > 0 && (
							<Standings standings={simulation.lcqStandings} teams={teams} />
						)}
						{simulation.tied.length > 0 && (
							<label className="block font-semibold">
								Empate pela última vaga na final do LCQ. Escolha a equipe
								eliminada no seu cenário.
								<select
									className="ml-2 rounded-md border border-[#b7c9c0] bg-white px-2 py-1"
									value={simulation.lcqEliminated ?? ""}
									onChange={(event) =>
										apply({
											...draft,
											lcqEliminated: event.target.value || undefined,
										})
									}
								>
									<option value="">Selecione uma equipe</option>
									{simulation.tied.map((id) => (
										<option value={id} key={id}>
											{teams.get(id)?.name}
										</option>
									))}
								</select>
							</label>
						)}
					</div>
				)}

				{rounds.map((round) => (
					<section key={round} aria-label={round} className="mt-6">
						<h3 className="mb-3 font-bold text-[#144e42]">{round}</h3>
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{visible
								.filter((match) => match.round === round)
								.map((match) => (
									<div key={match.id} className="min-w-0">
										<div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
											<span>
												{match.label} · MD{match.bestOf}
											</span>
											{match.score && match.origin !== "real" && (
												<button
													type="button"
													className="text-[#144e42] hover:underline"
													onClick={() => setScore(match, null)}
												>
													Limpar placar
												</button>
											)}
										</div>
										<MatchCard
											key={JSON.stringify([match.teams, match.score])}
											match={match}
											teams={teams}
											onPick={(score) => setScore(match, score)}
										/>
									</div>
								))}
						</div>
					</section>
				))}

				<footer className="mt-8 space-y-2 border-t border-[#dce2e7] pt-4 text-xs text-slate-600">
					<p>
						Os pareamentos simulados seguem a ordem das equipes informadas. A
						fase suíça agrupa campanhas iguais e evita revanche. Para ordenar
						vagas empatadas nos playoffs, o cenário usa saldo de mapas e a ordem
						inicial.
					</p>
					<p>Palpites salvos neste navegador.</p>
					<a
						href={config?.source ?? americasRegions.br.source}
						className="inline-flex items-center gap-1 font-semibold text-[#144e42] hover:underline"
					>
						Formato oficial <ArrowUpRight size={14} aria-hidden="true" />
					</a>
				</footer>
			</div>
		</main>
	);
}

function RosterForm({
	region,
	roster,
	onSave,
}: {
	region: AmericasRegion;
	roster: AmericasDraft["rosters"][AmericasRegion];
	onSave: (roster: AmericasDraft["rosters"][AmericasRegion]) => void;
}) {
	const [error, setError] = useState(false);
	const { openSpots } = americasRegions[region];

	function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const values = new FormData(event.currentTarget);
		const lines = (field: keyof typeof roster) =>
			String(values.get(field) ?? "")
				.split(/\r?\n/)
				.map((name) => name.trim())
				.filter(Boolean);
		const next = {
			open1: lines("open1"),
			open2: lines("open2"),
			invited: lines("invited"),
		};
		const valid = validRosters(region, next);
		setError(!valid);
		if (valid) onSave(next);
	}

	return (
		<details className="mt-4 rounded-xl border border-[#dce2e7] bg-white p-4">
			<summary className="cursor-pointer text-sm font-semibold text-[#144e42]">
				Editar equipes de {americasRegions[region].name}
			</summary>
			<form className="mt-4 space-y-3" onSubmit={save}>
				<p className="text-sm text-slate-600">
					Uma equipe por linha, em ordem de seed. Para começar no suíço,
					preencha somente as {openSpots} equipes classificadas em cada seletiva
					e os {openSpots * 2} convidados.
				</p>
				<div className="grid gap-3 sm:grid-cols-3">
					{(["open1", "open2", "invited"] as const).map((field, index) => (
						<label key={field} className="text-sm font-semibold">
							{["Seletiva 1", "Seletiva 2", "Convidados"][index]}
							<textarea
								name={field}
								rows={5}
								className="mt-1 block w-full rounded-md border border-[#b7c9c0] px-2 py-1.5 text-sm font-normal"
								defaultValue={roster[field].join("\n")}
							/>
						</label>
					))}
				</div>
				{error && (
					<p role="alert" className="text-sm text-red-800">
						Use de {openSpots} a 512 equipes por seletiva e {openSpots * 2}{" "}
						convidados. Os nomes devem ter até 60 caracteres, sem repetição na
						mesma lista ou entre convidados e seletivas.
					</p>
				)}
				<button className={pill} type="submit">
					Aplicar equipes
				</button>
			</form>
		</details>
	);
}

function Standings({
	standings,
	teams,
}: {
	standings: { team: string; wins: number; losses: number; maps: number }[];
	teams: ReturnType<typeof americasTeams>;
}) {
	return (
		<details className="rounded-xl border border-[#dce2e7] bg-white p-4">
			<summary className="cursor-pointer font-semibold text-[#144e42]">
				Classificação
			</summary>
			<table className="mt-3 w-full text-left text-sm">
				<thead>
					<tr>
						<th>Equipe</th>
						<th>V–D</th>
						<th>Saldo de mapas</th>
					</tr>
				</thead>
				<tbody>
					{standings.map(({ team, wins, losses, maps }) => (
						<tr className="border-t border-[#e1e7e2]" key={team}>
							<td className="py-1.5 pr-2">{teams.get(team)?.name}</td>
							<td>
								{wins}–{losses}
							</td>
							<td>
								{maps > 0 ? "+" : ""}
								{maps}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</details>
	);
}
