import { load } from "cheerio/slim";
import {
	type VctMatch,
	type VctSnapshot,
	validateVctSnapshot,
	vctMatchSchema,
	vctSources,
} from "./results";

export const VLR_MAX_BYTES = 2_000_000;
const text = (value: string) => value.replace(/\s+/g, " ").trim();
export function parseVlrEvent(html: string, eventId: number) {
	const source = vctSources.find((s) => s.id === eventId);
	if (!source || new TextEncoder().encode(html).length > VLR_MAX_BYTES)
		throw new Error("Invalid VLR source");
	const $ = load(html);
	if (!text($("h1.event-header-main-title").text()).includes(source.title))
		throw new Error("Unexpected VLR event page");
	const nav = $("a.wf-nav-item.mod-active").filter(
		(_, el) =>
			$(el).attr("href") === `/event/matches/${source.id}/${source.slug}`,
	);
	const countText = nav.find("sup").text();
	if (!/^\(\d+\)$/.test(countText))
		throw new Error("Missing VLR coverage count");
	const count = Number(countText.slice(1, -1));
	const cards = $("a.match-item");
	if (count > 1000 || cards.length !== count)
		throw new Error("Incomplete VLR match listing");
	const matches: VctMatch[] = [];
	cards.each((_, el) => {
		const card = $(el);
		const href = card.attr("href") ?? "";
		if (!/^\/\d+\/[a-z0-9-]+$/.test(href))
			throw new Error("Unexpected VLR match link");
		const teams = card.find(".match-item-vs-team");
		if (teams.length !== 2) throw new Error("Missing VLR team");
		const names = teams
			.toArray()
			.map((t) => text($(t).find(".match-item-vs-team-name").text()));
		const scores = teams
			.toArray()
			.map((t) => text($(t).find(".match-item-vs-team-score").text()));
		const state = text(card.find(".ml-status").text()).toLowerCase();
		const status =
			state === "completed"
				? "completed"
				: state === "live"
					? "live"
					: state === "upcoming"
						? "upcoming"
						: null;
		if (!status) throw new Error("Unknown VLR status");
		const note = text(card.find(".match-item-note").text());
		let outcome: VctMatch["outcome"] = { kind: "unavailable" };
		if (/\b(forfeit|walkover)\b|\bw\.?o\.?(?:\s|$)/i.test(note)) {
			const winners = teams
				.toArray()
				.flatMap((t, i) => ($(t).hasClass("mod-winner") ? [i] : []));
			if (status !== "completed" || winners.length !== 1)
				throw new Error("Ambiguous VLR forfeit");
			outcome = { kind: "forfeit", winner: winners[0] as 0 | 1 };
		} else if (status === "completed" && scores.every((s) => s === "0"))
			outcome = { kind: "unavailable" };
		else if (scores.every((s) => /^[0-3]$/.test(s)))
			outcome = {
				kind: "reported-score",
				score: [Number(scores[0]), Number(scores[1])],
			};
		else if (
			!scores.every((s) => /^[0-3]$/.test(s) || ["–", "-", "—", ""].includes(s))
		)
			throw new Error("Unknown VLR score");
		const round = text(card.find(".match-item-event-series").text());
		const stage =
			text(
				card.find(".match-item-event").clone().children().remove().end().text(),
			) || source.title;
		matches.push(
			vctMatchSchema.parse({
				id: `vlr-${href.split("/")[1]}`,
				eventId,
				url: `https://www.vlr.gg${href}`,
				teams: names,
				round,
				stage,
				status,
				outcome,
			}),
		);
	});
	if (new Set(matches.map((m) => m.id)).size !== matches.length)
		throw new Error("Duplicate VLR matches");
	return { id: eventId, count, matches };
}

export async function collectVlrBrazil(
	fetcher: typeof fetch = fetch,
	now = new Date(),
): Promise<VctSnapshot> {
	const events = [];
	for (const source of vctSources) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 15_000);
		try {
			const response = await fetcher(
				`https://www.vlr.gg/event/matches/${source.id}/${source.slug}/?series_id=all`,
				{
					redirect: "error",
					signal: controller.signal,
					headers: {
						Accept: "text/html",
						"User-Agent":
							"esports-simulator/1.0 (+https://github.com/joaokhalaf/esports-simulator)",
					},
				},
			);
			if (
				!response.ok ||
				!response.headers.get("content-type")?.includes("text/html") ||
				Number(response.headers.get("content-length")) > VLR_MAX_BYTES ||
				!response.body
			)
				throw new Error("VLR source unavailable");
			const reader = response.body.getReader();
			const decoder = new TextDecoder("utf-8", {
				fatal: true,
				ignoreBOM: false,
			});
			let html = "";
			let bytes = 0;
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					bytes += value.byteLength;
					if (bytes > VLR_MAX_BYTES) throw new Error("VLR response too large");
					html += decoder.decode(value, { stream: true });
				}
				html += decoder.decode();
			} finally {
				await reader.cancel();
			}
			events.push(parseVlrEvent(html, source.id));
		} finally {
			clearTimeout(timer);
			controller.abort();
		}
	}
	const matches = events
		.flatMap((e) => e.matches)
		.sort((a, b) => a.id.localeCompare(b.id));
	const coverage = events.map(({ id, count }) => ({ id, count }));
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(JSON.stringify({ events: coverage, matches })),
	);
	const id = `vlr-br-${Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("")}`;
	return validateVctSnapshot({
		id,
		collectedAt: now.toISOString(),
		events: coverage,
		matches,
	});
}
