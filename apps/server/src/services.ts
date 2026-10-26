import { createAuth } from "@esports-simulator/auth";
import { createDb } from "@esports-simulator/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
