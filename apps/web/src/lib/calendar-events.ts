export type CalendarEvent = {
	name: string;
	date?: string;
	detail: string;
	source: string;
};

const riotHosts = "https://lolesports.com/en-US/news/lol-esports-in-2025";
const valorant = "https://valorantesports.com";
const vctSeason = `${valorant}/en-GB/season/117246370678200773`;
const vctEvents = `${valorant}/en-PH/valorantesports/events`;
const brazil = `${valorant}/pt-BR/news/2027-vct-americas-kickoff-brazil-qualifiers`;
const northAmerica = `${valorant}/en-US/news/2027-vct-americas-kickoff-north-america-qualifiers`;
const latam = `${valorant}/es-MX/valorantesports/news/2027-vct-americas-kickoff-latam-qualifiers`;
const emea = `${valorant}/en-GB/valorantesports/news/2027-vct-emea-kickoff-qualifiers`;
const southeastAsia = `${valorant}/en-SG/news/introducing-vct-pacific-kickoff-southeast-asia-qualifier/`;

export const lolInternationalEvents: CalendarEvent[] = [
	{
		name: "First Stand 2027",
		detail: "Sudeste Asiático · Riot Games",
		source: riotHosts,
	},
	{ name: "MSI 2027", detail: "Europa · Riot Games", source: riotHosts },
	{
		name: "Esports World Cup 2027",
		date: "Julho a agosto",
		detail: "Janela do evento multijogo. Dias do LoL a confirmar.",
		source: "https://ewc-web.prod.esf-systems.com/en",
	},
	{
		name: "Worlds 2027",
		detail: "Coreia do Sul · Riot Games",
		source: riotHosts,
	},
	{
		name: "Esports Nations Cup 2027",
		date: "Novembro",
		detail: "Evento de seleções adiado de 2026 para 2027.",
		source:
			"https://www.esportsnationscup.com/en/press-releases/ef-postpones-enc-to-november-2027",
	},
];

export const lolRegionalEvents: CalendarEvent[] = [
	{
		name: "LCP Promotion Series 2026",
		date: "10 a 13 de nov. de 2026",
		detail: "Disputa por vagas na LCP em Ho Chi Minh, Vietnã.",
		source:
			"https://lolesports.com/en-PH/news/lcp-2026-promotion-series-everything-you-need-to-know",
	},
	{
		name: "CBLOL 2027",
		detail: "Brasil",
		source: "https://lolesports.com/pt-BR/leagues/cblol",
	},
	{
		name: "LCS 2027",
		detail: "América do Norte",
		source: "https://lolesports.com/en-US/leagues/lcs",
	},
	{
		name: "LEC 2027",
		detail: "Europa, Oriente Médio e África",
		source: "https://lolesports.com/en-GB/leagues/lec",
	},
	{
		name: "LCK 2027",
		detail: "Coreia do Sul",
		source: "https://lolesports.com/ko-KR/leagues/lck",
	},
	{
		name: "LPL 2027",
		detail: "China",
		source: "https://lolesports.com/en-GB/leagues/lpl",
	},
	{
		name: "LCP 2027",
		detail:
			"Ásia-Pacífico. A temporada começa nas ligas locais PCS, VCS e LJL.",
		source:
			"https://lolesports.com/en-SG/lolesports/news/a-more-open-lcp-ecosystem-in-2027",
	},
];

export const vctQualifiers: { region: string; events: CalendarEvent[] }[] = [
	{
		region: "VCT Americas",
		events: [
			{
				name: "Brasil",
				date: "5–7 e 9 nov. · 12–14 e 16 nov.",
				detail: "Suíço de 20–22 nov. Playoffs de 26–29 nov. e 3–6 dez.",
				source: brazil,
			},
			{
				name: "América do Norte",
				date: "5–8 nov. · 12–15 nov.",
				detail: "Suíço de 20–22 nov. e playoffs de 1–6 dez.",
				source: northAmerica,
			},
			{
				name: "LATAM Norte",
				date: "5–8 nov. · 12–15 nov.",
				detail: "Suíço em 20, 22 e 24 nov. Playoffs em 28 nov. e 4–6 dez.",
				source: latam,
			},
			{
				name: "LATAM Sul",
				date: "5–8 nov. · 12–15 nov.",
				detail: "Suíço em 21, 23 e 25 nov. Playoffs em 29 nov. e 3, 5 e 6 dez.",
				source: latam,
			},
			{
				name: "Final LATAM",
				date: "16 de dezembro",
				detail: "Decisão entre Norte e Sul.",
				source: latam,
			},
			{
				name: "Americas LCQ",
				date: "17 e 18 de dezembro",
				detail: "Última vaga do Kickoff, em São Paulo.",
				source: brazil,
			},
		],
	},
	{
		region: "VCT EMEA",
		events: [
			{
				name: "Europa",
				date: "5–8 nov. · 12–15 nov.",
				detail: "Playoffs de 26 nov. a 5 dez.",
				source: emea,
			},
			{
				name: "Turquia",
				date: "10–13 nov. · 18–21 nov.",
				detail: "Playoffs de 25 nov. a 6 dez.",
				source: emea,
			},
			{
				name: "Oriente Médio e Norte da África",
				date: "1–3 nov. · 9–11 nov.",
				detail: "Decisões regionais em 20 nov. e final MENA em 6 dez.",
				source: emea,
			},
		],
	},
	{
		region: "VCT Pacific",
		events: [
			{
				name: "Sul da Ásia",
				date: "17 a 20 de novembro",
				detail: "Playoffs de 23–29 nov.",
				source: `${valorant}/en-SG/news/introducing-vct-pacific-kickoff-south-asia-qualifier/`,
			},
			{
				name: "Oceania",
				date: "21 e 22 de novembro",
				detail: "Evento principal de 25–29 nov.",
				source: `${valorant}/en-AU/news/introducing-vct-pacific-kickoff-oce-qualifier`,
			},
			{
				name: "Japão",
				date: "22, 23, 28 e 29 de nov.",
				detail: "Playoffs de 2–6 dez. e finais em 11–12 dez.",
				source: `${valorant}/ja-JP/news/2027-vct-pacific-kickoff-japan-qualifier`,
			},
			{
				name: "Vietnã",
				date: "24 a 28 de novembro",
				detail: "Classificatória 1 do Sudeste Asiático.",
				source: southeastAsia,
			},
			{
				name: "Tailândia e demais países do Sudeste Asiático",
				date: "24–28 nov. · 1–5 dez.",
				detail:
					"Duas classificatórias, seguidas pelos playoffs do Sudeste Asiático.",
				source: southeastAsia,
			},
			{
				name: "Coreia do Sul",
				date: "25 e 26 de novembro",
				detail: "Playoffs de 30 nov. a 6 dez.",
				source: `${valorant}/ko-KR/news/2027-vct-pacific-kickoff-korea-qualifier-registration-info/`,
			},
			{
				name: "Indonésia",
				date: "1 a 5 de dezembro",
				detail: "Classificatória 2 do Sudeste Asiático.",
				source: southeastAsia,
			},
			{
				name: "Playoffs do Sudeste Asiático",
				date: "7 a 13 de dezembro",
				detail: "Disputa por vaga direta no Kickoff Pacific.",
				source: southeastAsia,
			},
			{
				name: "Pacific LCQ",
				detail: "Última vaga do Kickoff Pacific.",
				source: `${valorant}/en-SG/news/vct-pacific-2027-primer`,
			},
		],
	},
	{
		region: "VCT CN",
		events: [
			{
				name: "China",
				date: "31 out. a 30 dez.",
				detail:
					"Janela do circuito. Dias de jogo a confirmar no calendário internacional.",
				source: `${vctSeason}/kickoff-oq/china`,
			},
		],
	},
];

export const vctInternationalEvents: CalendarEvent[] = [
	{
		name: "Red Bull Home Ground 2026",
		date: "10 a 13 de dezembro",
		detail: "Final mundial em Los Angeles.",
		source: northAmerica,
	},
	{
		name: "Masters Seul 2027",
		date: "20 fev. a 7 mar.",
		detail: "Coreia do Sul",
		source: vctSeason,
	},
	{
		name: "Masters Valência 2027",
		date: "5 a 20 de junho",
		detail: "Espanha",
		source: vctSeason,
	},
	{
		name: "Esports World Cup 2027",
		date: "Julho a agosto",
		detail: "Janela do evento multijogo. Dias de VALORANT a confirmar.",
		source:
			"https://ewc-web.prod.esf-systems.com/en/press-releases/valorant-returns-to-ewc-2027",
	},
	{
		name: "Champions Austin 2027",
		date: "16 set. a 10 out.",
		detail: "Estados Unidos",
		source: vctSeason,
	},
];

export const vctRegionalEvents: CalendarEvent[] = [
	{
		name: "Kickoff Pacific",
		date: "A partir de 11 de janeiro",
		detail: "Bangkok, Tailândia",
		source: vctEvents,
	},
	{
		name: "Kickoff Americas",
		date: "A partir de 13 de janeiro",
		detail: "São Paulo, Brasil",
		source: vctEvents,
	},
	{
		name: "Kickoff EMEA",
		date: "A partir de 14 de janeiro",
		detail: "Europa, Oriente Médio e África",
		source: vctEvents,
	},
	{
		name: "Kickoff CN",
		date: "A partir de 14 de janeiro",
		detail: "China",
		source: vctEvents,
	},
	{
		name: "Classificatórias da Etapa 1",
		date: "A partir de 13 de janeiro",
		detail: "Circuitos regionais que dão acesso à Cup 1.",
		source: vctSeason,
	},
	{
		name: "Cup 1",
		date: "A partir de 24 de abril",
		detail: "Americas, EMEA, Pacific e CN",
		source: vctSeason,
	},
	{
		name: "Classificatórias da Etapa 2",
		date: "A partir de 29 de abril",
		detail: "Circuitos regionais que dão acesso à Cup 2.",
		source: vctSeason,
	},
	{
		name: "Cup 2",
		date: "A partir de 7 de agosto",
		detail: "Americas, EMEA, Pacific e CN",
		source: vctSeason,
	},
];
