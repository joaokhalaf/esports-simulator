import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { findEffects, violations } from "./check-architecture.mjs";

const forbidden = [
	'import * as R from "react"; const ReactAlias = R satisfies typeof R; ReactAlias.useEffect(() => {}, []);',
	'const { "useEffect": effect } = require("react"); effect(() => {}, []);',
	'import { useEffect } from "react"; useEffect(() => {}, []);',
	'import { useEffect as effect } from "react"; effect(() => {}, []);',
	'import React from "react"; React.useEffect(() => {}, []);',
	'import * as R from "react"; R["useEffect"](() => {}, []);',
	'import * as R from "react"; const ReactAlias = R; ReactAlias.useEffect(() => {}, []);',
	'import { useEffect } from "react"; const effect = useEffect; effect(() => {}, []);',
	'const { useEffect: effect } = require("react"); effect(() => {}, []);',
	'const R = await import("react"); R.useEffect(() => {}, []);',
	'export { useEffect as effect } from "react";',
	'export * from "react";',
];
for (const source of forbidden)
	test(`rejects ${source}`, () => assert.ok(findEffects(source).length > 0));

for (const source of [
	'import { useState } from "react"; useState(0);',
	'import * as React from "react"; React.useMemo(() => 1, []);',
	'const message = "useEffect"; /* useEffect */',
	'import { useEffect } from "another-library"; useEffect();',
	'import * as React from "react"; function scoped(React) { React.useEffect(); }',
])
	test(`permits ${source}`, () => assert.equal(findEffects(source).length, 0));

test("baseline cannot cover extra copies, new files or changed callbacks", () => {
	const source =
		'import { useEffect } from "react"; useEffect(() => { subscribe(); }, []);';
	const effects = findEffects(source);
	const counts = {};
	for (const { fingerprint } of effects)
		counts[fingerprint] = (counts[fingerprint] ?? 0) + 1;
	const baseline = { "legacy.tsx": counts };
	assert.equal(violations("legacy.tsx", effects, baseline).length, 0);
	assert.ok(violations("new.tsx", effects, baseline).length > 0);
	assert.ok(
		violations(
			"legacy.tsx",
			findEffects(`${source} useEffect(() => { subscribe(); }, []);`),
			baseline,
		).length > 0,
	);
	assert.ok(
		violations(
			"legacy.tsx",
			findEffects(source.replace("subscribe()", "other()")),
			baseline,
		).length > 0,
	);
	assert.equal(violations("legacy.tsx", [], baseline).length, 0);
});

test("Biome blocks frontend database imports and permits the API boundary", () => {
	const directory = mkdtempSync(resolve(tmpdir(), "esports-policy-"));
	try {
		const config = JSON.parse(
			readFileSync(new URL("../biome.json", import.meta.url), "utf8"),
		);
		const frontend = config.overrides.find((entry) =>
			entry.includes.includes("apps/web/src/**"),
		);
		assert.ok(frontend, "frontend override must exist");
		writeFileSync(
			resolve(directory, "biome.json"),
			JSON.stringify({ linter: frontend.linter }),
		);
		const biome = resolve("node_modules/.bin/biome");
		for (const [module, forbidden] of [
			["@esports-simulator/db", true],
			["@esports-simulator/db/worlds", true],
			["@esports-simulator/api/worlds/model", false],
		]) {
			const path = resolve(directory, "probe.ts");
			writeFileSync(
				path,
				`import * as data from "${module}";\nconsole.log(data);\n`,
			);
			const result = spawnSync(
				biome,
				["lint", "--config-path", directory, path],
				{ encoding: "utf8" },
			);
			assert.equal(result.status, forbidden ? 1 : 0, result.stderr);
			if (forbidden) assert.match(result.stderr, /noRestrictedImports/);
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
