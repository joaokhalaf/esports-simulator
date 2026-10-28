import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
	...base,
	outputDir: "test-results/cloudflare",
	reporter: process.env.CI
		? [
				["github"],
				[
					"html",
					{ open: "never", outputFolder: "playwright-report/cloudflare" },
				],
			]
		: "list",
	webServer: {
		command: "pnpm --filter server exec tsx test/serve-cloudflare.ts",
		url: "http://localhost:3101/health",
		reuseExistingServer: false,
	},
});
