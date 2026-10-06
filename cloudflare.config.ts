import { bindings, defineConfig, exports, triggers } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

// The game page is a static asset under public/games/botbattle/, so its URL matches the route on mpts.ie.
// Requests that aren't assets (the online API) reach the Worker: rooms are Durable Objects, the leaderboard is D1.
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
		env: {
			ROOMS: bindings.durableObject({ worker: "botbattle", exportName: "Room" }),
			DB: bindings.d1({ name: "botbattle" }),
		},
		exports: {
			Room: exports.durableObject({ storage: "sqlite" }),
		},
	},
});
