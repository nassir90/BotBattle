import { defineConfig, triggers } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

// Static site: everything under public/ is served as an asset. The page lives in
// public/games/botbattle/ so its URL matches the route on mpts.ie.
export default defineConfig({
	worker: {
		name: "botbattle",
		compatibilityDate: "2026-10-06",
		entrypoint,
		assets: {
			htmlHandling: "auto-trailing-slash",
			notFoundHandling: "none",
		},
		triggers: [triggers.fetch({ pattern: "mpts.ie/games/botbattle*", zone: "mpts.ie" })],
	},
});
