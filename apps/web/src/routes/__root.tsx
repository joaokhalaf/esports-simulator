import { Toaster } from "@esports-simulator/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";

import { ThemeProvider } from "@/components/theme-provider";
import type { orpc } from "@/utils/orpc";

import "../index.css";

export interface RouterAppContext {
	orpc: typeof orpc;
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: "bracket. · Worlds 2026",
			},
			{
				name: "description",
				content:
					"Simule o Worlds 2026: escolha placares, acompanhe o suíço e salve seus palpites neste navegador.",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
			},
		],
	}),
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="light"
				forcedTheme="light"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				<div className="min-h-svh">
					<Outlet />
				</div>
				<Toaster richColors />
			</ThemeProvider>
		</>
	);
}
