import { randomUUID } from "node:crypto";
import * as repository from "@esports-simulator/db/worlds";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure } from "../index";
import { simulate } from "../worlds/engine";
import {
	type Snapshot,
	scenarioSchema,
	snapshotSchema,
	validateSnapshot,
} from "../worlds/model";
import { importWorlds, makeSnapshot } from "../worlds/riot";
import seed from "../worlds/seed.json";

const initial = validateSnapshot(seed);
const adminProcedure = protectedProcedure.use(async ({ context, next }) => {
	if (!context.isAdmin)
		throw new ORPCError("FORBIDDEN", {
			message: "Acesso restrito à administração.",
		});
	return next();
});
const storageError = () =>
	new ORPCError("SERVICE_UNAVAILABLE", {
		message:
			"Não foi possível acessar o banco. Confira a conexão e aplique as migrações para salvar cenários.",
	});

export const worldsRouter = {
	latest: publicProcedure.handler(async ({ context }) => {
		try {
			const row = await repository.latestSnapshot(context.db);
			return {
				snapshot: row ? validateSnapshot(row.payload) : initial,
				storageAvailable: true,
				isAdmin: context.isAdmin,
			};
		} catch {
			return {
				snapshot: initial,
				storageAvailable: false,
				isAdmin: context.isAdmin,
			};
		}
	}),
	live: publicProcedure.handler(async ({ context }) => {
		try {
			const snapshot = await importWorlds();
			// An import is append-only; publishing never rewrites an existing scenario.
			try {
				await repository.publishSnapshot(context.db, snapshot, snapshot);
			} catch {
				/* Local simulation remains available without a database. */
			}
			return snapshot;
		} catch {
			throw new ORPCError("SERVICE_UNAVAILABLE", {
				message:
					"A importação do LoL Esports falhou. Seu cenário permanece na versão anterior; tente novamente em instantes.",
			});
		}
	}),
	save: protectedProcedure
		.input(
			z.object({ snapshotId: z.string().max(100), scenario: scenarioSchema }),
		)
		.handler(async ({ input, context }) => {
			try {
				const row = await repository.findSnapshot(context.db, input.snapshotId);
				const snapshot = row
					? validateSnapshot(row.payload)
					: input.snapshotId === initial.id
						? initial
						: await importWorlds();
				if (snapshot.id !== input.snapshotId)
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Esta versão não está mais disponível para salvar. Importe os dados novamente em um novo cenário.",
					});
				const simulation = simulate(snapshot, input.scenario);
				for (const [id, pick] of Object.entries(input.scenario.picks)) {
					const match = simulation.matches.find((m) => m.id === id);
					if (
						match?.origin !== "simulated" ||
						JSON.stringify(match.teams) !== JSON.stringify(pick.teams) ||
						JSON.stringify(match.score) !== JSON.stringify(pick.score)
					)
						throw new ORPCError("BAD_REQUEST", {
							message:
								"O cenário contém resultados incompatíveis com seus confrontos.",
						});
				}
				const id = randomUUID();
				await repository.saveScenario(context.db, snapshot, snapshot, {
					id,
					ownerId: context.session.user.id,
					name: input.scenario.name,
					payload: input.scenario,
				});
				return { id };
			} catch (error) {
				if (error instanceof ORPCError) throw error;
				throw storageError();
			}
		}),
	mine: protectedProcedure.handler(async ({ context }) => {
		try {
			return await repository.listScenarios(
				context.db,
				context.session.user.id,
			);
		} catch {
			throw storageError();
		}
	}),
	shared: publicProcedure
		.input(z.object({ id: z.string().uuid() }))
		.handler(async ({ context, input }) => {
			try {
				const row = await repository.findScenario(context.db, input.id);
				if (!row)
					throw new ORPCError("NOT_FOUND", {
						message: "Cenário não encontrado.",
					});
				return {
					snapshot: validateSnapshot(row.snapshot),
					scenario: scenarioSchema.parse(row.scenario),
				};
			} catch (error) {
				if (error instanceof ORPCError) throw error;
				throw storageError();
			}
		}),
	publish: adminProcedure
		.input(z.object({ snapshot: snapshotSchema }))
		.handler(async ({ input, context }) => {
			let snapshot: Snapshot;
			try {
				const checked = validateSnapshot(input.snapshot);
				snapshot = makeSnapshot({
					source: "admin",
					tournamentId: checked.tournamentId,
					teams: checked.teams,
					matches: checked.matches,
				});
			} catch (error) {
				throw new ORPCError("BAD_REQUEST", {
					message: error instanceof Error ? error.message : "Dados inválidos.",
				});
			}
			try {
				await repository.publishSnapshot(context.db, snapshot, snapshot);
				return snapshot;
			} catch {
				throw storageError();
			}
		}),
};
