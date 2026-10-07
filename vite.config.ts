import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [cloudflare()],
	// the game's page imports three.js and partysocket from a CDN (its import map), so the page has nothing for Vite
	// to pre-bundle: without this, its scan for bare imports in the HTML warns that they aren't installed
	optimizeDeps: { noDiscovery: true },
});
