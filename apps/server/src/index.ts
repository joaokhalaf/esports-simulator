import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { ENV } from "./env.server";
import { auth, db } from "./services";

const app = createApp({ auth, db }, ENV);
serve({ fetch: app.fetch, port: ENV.PORT }, (info) => {
	console.log(`Server is running on http://localhost:${info.port}`);
});
