import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, CalendarDays, Trophy } from "lucide-react";
import {
	type CalendarEvent,
	lolInternationalEvents,
	lolRegionalEvents,
	vctInternationalEvents,
	vctQualifiers,
	vctRegionalEvents,
} from "@/lib/calendar-events";

export const Route = createFileRoute("/calendario")({
	component: InternationalCalendar,
	head: () => ({ meta: [{ title: "bracket. · Calendário internacional" }] }),
	validateSearch: (search: Record<string, unknown>): { game?: "valorant" } =>
		search.game === "valorant" ? { game: "valorant" } : {},
});

const worlds2026 = "https://lolesports.com/en-GB/news/worlds-2026-primer";

function InternationalCalendar() {
	const { game } = Route.useSearch();
	const isValorant = game === "valorant";
	return (
		<main className="min-h-svh bg-[#f5f7f4] px-5 py-8 text-[#101620] sm:px-10 sm:py-12">
			<div className="mx-auto max-w-4xl">
				<Link
					to="/"
					className="inline-flex items-center gap-2 text-sm font-semibold text-[#144e42] hover:underline"
				>
					<ArrowLeft size={16} aria-hidden="true" /> Voltar ao simulador
				</Link>
				<header className="my-8">
					<p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-widest text-[#144e42] uppercase">
						<CalendarDays size={16} aria-hidden="true" /> Esports · 2026–2027
					</p>
					<h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
						Calendário internacional
					</h1>
					<p className="mt-3 max-w-xl text-sm text-slate-600 sm:text-base">
						Datas oficiais de ligas regionais, classificatórias e torneios
						internacionais.
					</p>
				</header>
				<nav
					aria-label="Jogos no calendário"
					className="mb-6 flex flex-wrap gap-2"
				>
					<Link
						to="/calendario"
						search={{}}
						activeOptions={{ exact: true }}
						className="rounded-md border border-[#b7c9c0] px-4 py-2 text-sm font-semibold text-[#144e42] hover:bg-[#e6f2e9] aria-[current=page]:border-[#144e42] aria-[current=page]:bg-[#144e42] aria-[current=page]:text-white"
					>
						League of Legends
					</Link>
					<Link
						to="/calendario"
						search={{ game: "valorant" }}
						activeOptions={{ exact: true }}
						className="rounded-md border border-[#b7c9c0] px-4 py-2 text-sm font-semibold text-[#144e42] hover:bg-[#e6f2e9] aria-[current=page]:border-[#144e42] aria-[current=page]:bg-[#144e42] aria-[current=page]:text-white"
					>
						Valorant
					</Link>
				</nav>
				{isValorant ? <ValorantCalendar /> : <LolCalendar />}
				<p className="mt-5 text-xs text-slate-600">
					Fontes consultadas em{" "}
					<time dateTime="2026-11-08">8 de novembro de 2026</time>.
				</p>
			</div>
		</main>
	);
}

function LolCalendar() {
	return (
		<>
			<section
				aria-labelledby="worlds-calendar-heading"
				className="rounded-2xl bg-[#144e42] p-6 text-white sm:p-8"
			>
				<p className="mb-3 flex items-center gap-2 text-xs font-bold tracking-widest text-[#d5e9d9] uppercase">
					<Trophy size={16} aria-hidden="true" /> Destaque 2026
				</p>
				<h2 id="worlds-calendar-heading" className="text-2xl font-bold">
					Worlds 2026
				</h2>
				<p className="mt-2 text-sm text-[#d5e9d9]">
					15 de outubro a 14 de novembro · Estados Unidos
				</p>
				<p className="mt-3 font-semibold">
					Grande final em <time dateTime="2026-11-14">14 de novembro</time> ·
					Brooklyn, Nova York
				</p>
				<div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold">
					<Link
						to="/"
						className="rounded-md bg-white px-3 py-2 text-[#144e42] hover:bg-[#e6f2e9]"
					>
						Simular Worlds 2026
					</Link>
					<a
						href={worlds2026}
						className="inline-flex items-center gap-1 hover:underline"
					>
						Anúncio oficial <ArrowUpRight size={15} aria-hidden="true" />
					</a>
				</div>
			</section>
			<EventSection title="Ligas regionais" events={lolRegionalEvents} />
			<EventSection
				title="Internacionais · 2027"
				events={lolInternationalEvents}
			/>
		</>
	);
}

function ValorantCalendar() {
	return (
		<>
			<section className="rounded-2xl bg-[#144e42] p-6 text-white sm:p-8">
				<h2 className="text-2xl font-bold">
					Classificatórias para o VCT Kickoff 2027
				</h2>
				<p className="mt-2 text-sm text-[#d5e9d9]">
					As seletivas acontecem em 2026 e valem vagas no Kickoff de janeiro de
					2027. As datas seguem o calendário local de cada organizador.
				</p>
			</section>
			{vctQualifiers.map(({ region, events }) => (
				<EventSection key={region} title={region} events={events} />
			))}
			<EventSection
				title="Etapas regionais · 2027"
				events={vctRegionalEvents}
			/>
			<EventSection
				title="Torneios internacionais"
				events={vctInternationalEvents}
			/>
		</>
	);
}

function EventSection({
	title,
	events,
}: {
	title: string;
	events: CalendarEvent[];
}) {
	return (
		<section aria-label={title} className="mt-8">
			<h2 className="mb-4 text-xl font-bold">{title}</h2>
			<ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
				{events.map((event) => (
					<li
						key={event.name}
						className="grid gap-2 p-4 sm:grid-cols-[11rem_1fr_auto] sm:items-center sm:gap-4 sm:p-5"
					>
						<p className="text-sm font-bold text-[#144e42]">
							{event.date ?? "Datas a confirmar"}
						</p>
						<div>
							<h3 className="font-semibold">{event.name}</h3>
							<p className="mt-1 text-sm text-slate-600">{event.detail}</p>
						</div>
						<a
							href={event.source}
							aria-label={`Fonte oficial de ${event.name}`}
							className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-[#144e42] hover:underline"
						>
							Fonte oficial <ArrowUpRight size={14} aria-hidden="true" />
						</a>
					</li>
				))}
			</ul>
		</section>
	);
}
