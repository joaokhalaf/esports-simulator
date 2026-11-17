import * as repository from "@esports-simulator/db/vct";
import { publicProcedure } from "../index";
import { validateVctSnapshot } from "../vct/results";

export const vctRouter = {
	brazil: publicProcedure.handler(async ({ context }) => {
		try {
			const payload = await repository.latestBrazilResults(context.db);
			return {
				snapshot: payload ? validateVctSnapshot(payload) : null,
				storageAvailable: true,
			};
		} catch {
			return { snapshot: null, storageAvailable: false };
		}
	}),
};
