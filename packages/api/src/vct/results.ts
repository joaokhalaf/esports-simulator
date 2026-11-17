import { z } from "zod";

export const vctSources = [
	{
		id: 3187,
		slug: "vct-2027-america-kickoff-brazil-open-qualifier",
		title: "Brazil Open Qualifier",
	},
	{
		id: 3183,
		slug: "vct-2027-america-kickoff-brazil-qualifier-playoffs",
		title: "Brazil Qualifier Playoffs",
	},
] as const;
const team = z.string().trim().min(1).max(150);
const score = z.tuple([
	z.number().int().min(0).max(3),
	z.number().int().min(0).max(3),
]);
export const vctMatchSchema = z
	.object({
		id: z.string().regex(/^vlr-\d+$/),
		eventId: z.union([z.literal(3187), z.literal(3183)]),
		url: z.string().regex(/^https:\/\/www\.vlr\.gg\/\d+\/[a-z0-9-]+$/),
		teams: z.tuple([team, team]),
		stage: z.string().min(1).max(200),
		round: z.string().min(1).max(150),
		status: z.enum(["completed", "live", "upcoming"]),
		outcome: z.discriminatedUnion("kind", [
			z.object({ kind: z.literal("reported-score"), score }),
			z.object({
				kind: z.literal("forfeit"),
				winner: z.union([z.literal(0), z.literal(1)]),
			}),
			z.object({ kind: z.literal("unavailable") }),
		]),
	})
	.superRefine((match, ctx) => {
		if (match.teams[0] === match.teams[1] && !/^TBD$/i.test(match.teams[0]))
			ctx.addIssue({ code: "custom", message: "Repeated team" });
		if (match.url.split("/")[3] !== match.id.slice(4))
			ctx.addIssue({ code: "custom", message: "Mismatched match URL" });
		if (
			match.status === "completed" &&
			match.outcome.kind === "reported-score" &&
			match.outcome.score[0] === match.outcome.score[1]
		)
			ctx.addIssue({ code: "custom", message: "Tied completed series" });
		if (match.status !== "completed" && match.outcome.kind === "forfeit")
			ctx.addIssue({ code: "custom", message: "Unfinished forfeit" });
	});
export const vctSnapshotSchema = z.object({
	id: z.string().regex(/^vlr-br-[a-f0-9]{64}$/),
	collectedAt: z.iso.datetime(),
	events: z
		.array(
			z.object({
				id: z.number().int(),
				count: z.number().int().min(0).max(1000),
			}),
		)
		.length(2),
	matches: z.array(vctMatchSchema).max(2000),
});
export type VctMatch = z.infer<typeof vctMatchSchema>;
export type VctSnapshot = z.infer<typeof vctSnapshotSchema>;
export function validateVctSnapshot(input: unknown): VctSnapshot {
	const snapshot = vctSnapshotSchema.parse(input);
	if (
		new Set(snapshot.matches.map((m) => m.id)).size !== snapshot.matches.length
	)
		throw new Error("Duplicate VLR match");
	if (new Set(snapshot.events.map((e) => e.id)).size !== 2)
		throw new Error("Duplicate VLR event");
	for (const source of vctSources) {
		const event = snapshot.events.find((e) => e.id === source.id);
		if (
			!event ||
			event.count !==
				snapshot.matches.filter((m) => m.eventId === source.id).length
		)
			throw new Error("Incomplete VLR event");
	}
	return snapshot;
}
