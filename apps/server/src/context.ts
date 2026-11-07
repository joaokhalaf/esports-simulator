import type { Context as ApiContext } from "@esports-simulator/api/context";
import type { Context as HonoContext } from "hono";
import { ENV } from "./env.server";
import { auth, db } from "./services";

export type CreateContextOptions = {
	context: HonoContext;
};

export async function createContext({
	context,
}: CreateContextOptions): Promise<ApiContext> {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	return {
		db,
		session,
		isAdmin:
			!!session?.user &&
			(ENV.ADMIN_USER_IDS ?? "")
				.split(",")
				.map((id) => id.trim())
				.filter(Boolean)
				.includes(session.user.id),
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
