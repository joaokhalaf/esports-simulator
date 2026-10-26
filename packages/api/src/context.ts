import type { Session } from "@esports-simulator/auth";
import type { Database } from "@esports-simulator/db";

export type Context = {
  session: Session | null;
  db: Database;
};
