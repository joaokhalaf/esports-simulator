import { defineConfig, devices } from "@playwright/test";

const databaseUrl =
	process.env.TEST_DATABASE_URL ??
	"postgresql://postgres:password@localhost:55432/worlds_mvp";
const parsed = new URL(databaseUrl);
if (
	!["localhost", "127.0.0.1"].includes(parsed.hostname) ||
	!parsed.pathname.endsWith("/worlds_mvp")
)
	throw new Error("E2E requires an isolated local worlds_mvp database.");

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
	workers: 1,
	timeout: 30_000,
	use: { baseURL: "http://localhost:3101", trace: "retain-on-failure" },
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
					? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
					: {},
			},
		},
	],
	webServer: [
		{
			command: "pnpm --filter server exec tsx src/index.ts",
			url: "http://localhost:3100",
			reuseExistingServer: false,
			env: {
				NODE_ENV: "test",
				PORT: "3100",
				BETTER_AUTH_SECRET:
					"worlds-mvp-e2e-only-not-a-production-secret-123456789",
				BETTER_AUTH_URL: "http://localhost:3100",
				CORS_ORIGIN: "http://localhost:3101",
				DATABASE_URL: databaseUrl,
				ADMIN_USER_IDS: "",
			},
		},
		{
			command:
				"pnpm --filter web exec vite --host 127.0.0.1 --port 3101 --strictPort",
			url: "http://localhost:3101",
			reuseExistingServer: false,
			env: { VITE_SERVER_URL: "http://localhost:3100" },
		},
	],
});
