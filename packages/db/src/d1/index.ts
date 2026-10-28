import type { D1Database } from "@cloudflare/workers-types";

export type D1Store = { dialect: "d1"; binding: D1Database };
export function createD1Store(binding: D1Database): D1Store {
	return { dialect: "d1", binding };
}
