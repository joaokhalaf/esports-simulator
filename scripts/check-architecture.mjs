import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const printer = ts.createPrinter({ removeComments: true });

export function findEffects(source) {
	const file = ts.createSourceFile(
		"policy.tsx",
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);
	const program = ts.createProgram(
		[file.fileName],
		{ noLib: true, noResolve: true },
		{
			...ts.createCompilerHost({}),
			getSourceFile: (name) => (name === file.fileName ? file : undefined),
		},
	);
	const checker = program.getTypeChecker();
	const react = new Set();
	const hooks = new Set();
	const hits = new Map();
	const nodes = [];
	function visit(node) {
		nodes.push(node);
		ts.forEachChild(node, visit);
	}
	visit(file);
	const symbol = (node) => checker.getSymbolAtLocation(node);
	const unwrap = (value) => {
		let node = value;
		while (
			node &&
			(ts.isParenthesizedExpression(node) ||
				ts.isAwaitExpression(node) ||
				ts.isAsExpression(node) ||
				ts.isNonNullExpression(node))
		)
			node = node.expression;
		return node;
	};
	const moduleCall = (node) =>
		ts.isCallExpression(node) &&
		node.arguments.length === 1 &&
		ts.isStringLiteral(node.arguments[0]) &&
		node.arguments[0].text === "react" &&
		(node.expression.kind === ts.SyntaxKind.ImportKeyword ||
			(ts.isIdentifier(node.expression) &&
				node.expression.text === "require" &&
				!symbol(node.expression)));
	const isReact = (value) => {
		const node = unwrap(value);
		return (
			!!node &&
			((ts.isIdentifier(node) &&
				(react.has(symbol(node)) ||
					(!symbol(node) && node.text === "React"))) ||
				moduleCall(node))
		);
	};
	const isHook = (value) => {
		const node = unwrap(value);
		return (
			!!node &&
			((ts.isIdentifier(node) && hooks.has(symbol(node))) ||
				(ts.isPropertyAccessExpression(node) &&
					node.name.text === "useEffect" &&
					isReact(node.expression)) ||
				(ts.isElementAccessExpression(node) &&
					ts.isStringLiteral(node.argumentExpression) &&
					node.argumentExpression.text === "useEffect" &&
					isReact(node.expression)))
		);
	};
	const bind = (set, name) => {
		const value = symbol(name);
		if (value) set.add(value);
	};
	const add = (node) => {
		const text = printer.printNode(ts.EmitHint.Unspecified, node, file);
		const fingerprint = createHash("sha256").update(text).digest("hex");
		const line =
			file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
		hits.set(node.getStart(file), { fingerprint, line });
	};
	for (const node of nodes) {
		if (
			ts.isImportDeclaration(node) &&
			ts.isStringLiteral(node.moduleSpecifier) &&
			node.moduleSpecifier.text === "react"
		) {
			const clause = node.importClause;
			if (clause?.name) bind(react, clause.name);
			if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings))
				bind(react, clause.namedBindings.name);
			if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
				for (const item of clause.namedBindings.elements) {
					if ((item.propertyName ?? item.name).text === "useEffect") {
						bind(hooks, item.name);
						add(item);
					}
				}
			}
		}
		if (
			ts.isExportDeclaration(node) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier) &&
			node.moduleSpecifier.text === "react"
		) {
			if (!node.exportClause) add(node);
			else if (ts.isNamedExports(node.exportClause))
				for (const item of node.exportClause.elements)
					if ((item.propertyName ?? item.name).text === "useEffect") add(item);
		}
	}
	for (let pass = 0; pass < nodes.length; pass++) {
		const before = react.size + hooks.size;
		for (const node of nodes) {
			if (!ts.isVariableDeclaration(node) || !node.initializer) continue;
			if (ts.isIdentifier(node.name)) {
				if (isReact(node.initializer)) bind(react, node.name);
				if (isHook(node.initializer)) bind(hooks, node.name);
			} else if (
				ts.isObjectBindingPattern(node.name) &&
				isReact(node.initializer)
			) {
				for (const item of node.name.elements)
					if (
						ts.isIdentifier(item.name) &&
						(item.propertyName ?? item.name).getText(file) === "useEffect"
					) {
						bind(hooks, item.name);
						add(item);
					}
			}
		}
		if (before === react.size + hooks.size) break;
	}
	for (const node of nodes) {
		if (
			!isHook(node) ||
			ts.isImportSpecifier(node.parent) ||
			ts.isBindingElement(node.parent)
		)
			continue;
		if (
			ts.isIdentifier(node) &&
			((ts.isVariableDeclaration(node.parent) && node.parent.name === node) ||
				(ts.isPropertyAccessExpression(node.parent) &&
					node.parent.name === node))
		)
			continue;
		add(
			ts.isCallExpression(node.parent) && node.parent.expression === node
				? node.parent
				: node,
		);
	}
	return [...hits.values()];
}

export function violations(path, effects, baseline) {
	const remaining = new Map(Object.entries(baseline[path] ?? {}));
	return effects.filter(({ fingerprint }) => {
		const count = remaining.get(fingerprint) ?? 0;
		remaining.set(fingerprint, count - 1);
		return count <= 0;
	});
}

function main() {
	const baseline = JSON.parse(
		readFileSync(resolve(root, "scripts/architecture-baseline.json"), "utf8"),
	);
	const output = execFileSync(
		"git",
		[
			"ls-files",
			"--cached",
			"--others",
			"--exclude-standard",
			"-z",
			"--",
			"apps",
			"packages",
		],
		{ cwd: root },
	);
	const paths = [
		...new Set(
			output
				.toString()
				.split("\0")
				.filter(
					(path) => /\.(?:[cm]?[jt]sx?)$/.test(path) && !path.endsWith(".d.ts"),
				),
		),
	];
	let failed = false;
	for (const path of paths) {
		if (!existsSync(resolve(root, path))) continue;
		const source = readFileSync(resolve(root, path), "utf8");
		for (const hit of violations(path, findEffects(source), baseline)) {
			console.error(
				`${path}:${hit.line}: useEffect proibido. Use handlers, estado derivado, loaders/query ou uma API de domínio. Não troque por outro hook para contornar a regra.`,
			);
			failed = true;
		}
	}
	if (failed) process.exitCode = 1;
	else
		console.log(
			`Architecture checks passed (${paths.length} source files; explicit legacy baseline).`,
		);
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
	main();
