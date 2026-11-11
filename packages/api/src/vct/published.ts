import type { Score } from "../worlds/model";
import type { AmericasRegion } from "./americas";

// Curated snapshot. Never infer a score or an unannounced seed from qualification.
export const americasSnapshotDate = "11/11/2026";
export const americasSnapshotVersion = "2026-11-11" as const;
const invitesSource =
	"https://esportnow.com/news/valorant/riot-games-vct-2027-americas-kickoff-qualifier-invites/";
type PublishedMatch = { teams: [string, string]; score: Score; label: string };
type PublishedRegion = {
	qualified: string[];
	invited: string[];
	sources: { label: string; url: string }[];
	note: string;
	matches: PublishedMatch[];
};
const match = (
	a: string,
	b: string,
	score: Score,
	label = "Série de classificação",
): PublishedMatch => ({ teams: [a, b], score, label });
export const americasPublished: Record<AmericasRegion, PublishedRegion> = {
	br: {
		qualified: [
			"TIME DO B3M",
			"GANGUE",
			"BRASIL2002",
			"Mafiosos",
			"Arashi",
			"Piranhas do Caribe",
		],
		invited: [
			"Fluxo W7M",
			"2GAME",
			"Team Solid",
			"Next",
			"Elevate",
			"Manticore",
		],
		note: "Seis classificados: quatro pela chave principal e dois pela repescagem. GANGUE é o antigo elenco da Team Solid; a organização tem outra equipe convidada. A vitória de Piranhas do Caribe na repescagem foi por W.O.; não atribuímos placar de mapas.",
		sources: [
			{
				label: "Classificados · THESPIKE",
				url: "https://www.thespike.gg/br/valorant/news/valorant-veja-times-venceram-qualify-aberto-kickoff/9213",
			},
			{
				label: "Placares · VLR",
				url: "https://www.vlr.gg/event/3187/vct-2027-america-kickoff-brazil-open-qualifier/qualifier-1",
			},
			{ label: "Convidados", url: invitesSource },
		],
		matches: [
			match("Arashi", "TIME DO B3M", [0, 2]),
			match("CABO VERDE 2026", "GANGUE", [0, 2]),
			match("SÓ TEM VELHO", "BRASIL2002", [1, 2]),
			match("Piranhas do Caribe", "Mafiosos", [0, 2]),
			match("Arashi", "CABO VERDE 2026", [2, 1], "Repescagem"),
		],
	},
	na: {
		qualified: ["Winthrop University", "Masterclass", "Xora Esports", "Oafs"],
		invited: [
			"Cloud9",
			"Envy",
			"QoR Gaming",
			"FlyQuest",
			"YFP",
			"SAD Esports",
			"Shopify Rebellion Black",
			"Shopify Rebellion Gold",
		],
		note: "Quatro equipes classificadas na primeira seletiva. A ordem abaixo não representa o sorteio oficial da fase suíça.",
		sources: [
			{
				label: "Resultados · VLR",
				url: "https://www.vlr.gg/event/3186/vct-2027-america-kickoff-north-america-open-qualifier/qualifier-1",
			},
			{ label: "Convidados", url: invitesSource },
		],
		matches: [
			match("Wildcard", "Winthrop University", [0, 2]),
			match("counterfeit", "Masterclass", [0, 2]),
			match("Xora Esports", "Yellow Dragon Gaming", [2, 1]),
			match("Maryville University", "Oafs", [0, 2]),
		],
	},
	"latam-north": {
		qualified: ["STREAMER ARENA", "Squirtle Rangers"],
		invited: ["LEONES", "Chivas Esports", "BonBonBumContra", "Fuego"],
		note: "Duas equipes classificadas na primeira seletiva; pareamentos futuros ainda são cenários de simulação.",
		sources: [
			{
				label: "Resultados · VLR",
				url: "https://www.vlr.gg/event/3189/vct-2027-america-kickoff-latam-north-open-qualifier/qualifier-1",
			},
			{ label: "Convidados", url: invitesSource },
		],
		matches: [
			match("STREAMER ARENA", "Axolotitos Gaming", [2, 1]),
			match("Crimson Blade", "Squirtle Rangers", [1, 2]),
		],
	},
	"latam-south": {
		qualified: ["TRAMITE", "EL LEGADO"],
		invited: ["KRÜ Blaze", "9z", "University War", "Vaga pendente · LATAM Sul"],
		note: "Dois classificados e três convidados confirmados. A vaga restante ainda é um marcador pendente: não equivale a uma equipe confirmada nem presume quem recebe uma vaga extra.",
		sources: [
			{
				label: "Resultados · VLR",
				url: "https://www.vlr.gg/event/3190/vct-2027-america-kickoff-latam-south-open-qualifier/qualifier-1",
			},
			{ label: "Convidados", url: invitesSource },
		],
		matches: [
			match("ARG.MIX", "TRAMITE", [0, 2]),
			match("duendecillo5", "EL LEGADO", [0, 2]),
		],
	},
};
