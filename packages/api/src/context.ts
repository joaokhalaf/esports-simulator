import type { Session } from "@esports-simulator/auth";
import type { WorldsDatabase } from "@esports-simulator/db/worlds";

export type Context = {
	session: Session | null;
	db: WorldsDatabase;
	isAdmin: boolean;
};
