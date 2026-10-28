import { createTestRuntime } from "./runtime";

const mf = await createTestRuntime(3101);
console.log("Cloudflare test runtime ready on http://localhost:3101");
for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, async () => {
		await mf.dispose();
		process.exit(0);
	});
}
