import type { Context as ApiContext } from "@esports-simulator/api/context";
import type { Context as HonoContext } from "hono";
export type ApiServices = {
	db: ApiContext["db"];
	auth: {
		handler: (request: Request) => Promise<Response>;
		api: {
			getSession: (input: {
				headers: Headers;
			}) => Promise<ApiContext["session"]>;
		};
	};
};

export type CreateContextOptions = {
	context: HonoContext;
	services: ApiServices;
	adminUserIds?: string;
};

export async function createContext({
	context,
	services,
	adminUserIds,
}: CreateContextOptions): Promise<ApiContext> {
	const session = await services.auth.api.getSession({
		headers: context.req.raw.headers,
	});
	return {
		db: services.db,
		session,
		isAdmin:
			!!session?.user &&
			(adminUserIds ?? "")
				.split(",")
				.map((id) => id.trim())
				.filter(Boolean)
				.includes(session.user.id),
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
