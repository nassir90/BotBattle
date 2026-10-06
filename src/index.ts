// Bot Battle's server. The game page is a static asset; everything under /games/botbattle/api is handled here.
//   POST /api/rooms                 create a room (signed in): { name, password? } -> { key, name, invite }
//   POST /api/casual                a casual match (signed in): a room with someone waiting in it, or a new one -> { key, name }
//   GET  /api/rooms/<key>/ws        a room's WebSocket; the first message signs in and unlocks the room (see Room)
//   GET  /api/leaderboard           the top players
// Each room is a Durable Object named by its key (the name in lower case). It holds the password hash and the
// invite, the players in the lobby, and relays a match: everyone's controls to everyone, the host's state to guests.
// Casual rooms are made by the Casual object (one for the whole game), which hands each player a room someone is
// waiting in, or a new one to wait in. They hold two players, and the match starts once both are ready.
// Players sign in with Clerk; their session tokens are checked against Clerk's public signing keys.
import { DurableObject } from "cloudflare:workers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

type Env = { ROOMS: DurableObjectNamespace<Room>; CASUAL: DurableObjectNamespace<Casual>; DB: D1Database };

const API = "/games/botbattle/api";
const CLERK = "https://merry-filly-2600.clerk.accounts.dev";
const JWKS = createRemoteJWKSet(new URL(`${CLERK}/.well-known/jwks.json`));
const ORIGINS = new Set(["https://mpts.ie", "http://localhost:5173", "http://127.0.0.1:5173"]);
const KINDS = ["so", "gpt", "claude"];
// each fighter's colours, as on the fighter cards (the first is its own); two players may pick the same fighter
const VARIANTS: Record<string, string[]> = { so: ["orange", "blue"], gpt: ["green", "white"], claude: ["orange", "black"] };
const MAX_PLAYERS = 3, CASUAL_PLAYERS = 2;
const IDLE_MS = 10 * 60 * 1000;          // an empty room is deleted this long after its last player leaves
const profanity = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// room names: Latin letters, digits and spaces only, and nothing the profanity filter catches
function roomName(raw: unknown): { name: string; key: string } | { error: string } {
	const name = String(raw ?? "").trim().replace(/\s+/g, " ");
	if (!/^[A-Za-z0-9 ]{3,16}$/.test(name)) return { error: "Use 3 to 16 letters (A to Z), digits or spaces." };
	if (profanity.hasMatch(name)) return { error: "That name isn't allowed. Try another." };
	return { name, key: name.toLowerCase() };
}
// display names come from the player's Clerk profile; anything odd becomes "Player"
function displayName(raw: unknown) {
	const name = String(raw ?? "").replace(/[^A-Za-z0-9 _.-]/g, "").trim().slice(0, 16);
	return name.length >= 2 && !profanity.hasMatch(name) ? name : "Player";
}

// Casual matches: the rooms handed out lately, and who they were handed to. A player is sent to a room with one
// other player waiting in it (and no match on), or else to a new room of their own to wait in. A room counts the
// players who were sent to it but haven't arrived yet (for a little while), so two people asking at once don't
// both get the last place.
const PROMISE_MS = 20 * 1000, CASUAL_AGE_MS = 30 * 60 * 1000;
type Open = { key: string; name: string; created: number; promised: Record<string, number> };
export class Casual extends DurableObject<Env> {
	open: Open[] | null = null;      // kept in storage too: an idle object is unloaded, and its memory with it

	async find(user: string): Promise<{ key: string; name: string }> {
		this.open ??= (await this.ctx.storage.get<Open[]>("open")) ?? [];
		const keep = () => this.ctx.storage.put("open", this.open);
		for (const r of [...this.open]) {
			const s = await this.env.ROOMS.get(this.env.ROOMS.idFromName(r.key)).status();
			const now = Date.now();
			for (const [id, until] of Object.entries(r.promised)) if (until < now || s.players.includes(id)) delete r.promised[id];
			const coming = Object.keys(r.promised).length;
			if (!s.exists || s.playing || now - r.created > CASUAL_AGE_MS || (!s.players.length && !coming)) {
				this.open = this.open.filter(o => o !== r);
				continue;
			}
			if (s.players.includes(user) || r.promised[user] || s.players.length + coming < CASUAL_PLAYERS) {
				r.promised[user] = now + PROMISE_MS;
				await keep();
				return { key: r.key, name: r.name };
			}
		}
		// nobody waiting: a new room, with a made-up name
		const words = ["paper", "ink", "stack", "token", "prompt", "cursor", "rotor", "beam"];        // six letters at most
		for (;;) {
			const name = `Casual ${words[Math.floor(Math.random() * words.length)]} ${Math.floor(Math.random() * 90 + 10)}`;   // 16 at most, like any room name
			const key = name.toLowerCase();
			const made = await this.env.ROOMS.get(this.env.ROOMS.idFromName(key)).create(name, key, "", true);
			if ("error" in made) continue;                  // that name's in use: another
			this.open.push({ key, name, created: Date.now(), promised: { [user]: Date.now() + PROMISE_MS } });
			await keep();
			return { key, name };
		}
	}
}

// a signed-in player: their Clerk user id. Locally (cf dev), "dev:<name>" stands in, for testing without Clerk.
async function signedIn(token: unknown, local: boolean): Promise<string | null> {
	if (typeof token !== "string" || !token) return null;
	if (local && token.startsWith("dev:")) return token;
	try {
		const { payload } = await jwtVerify(token, JWKS, { issuer: CLERK });
		if (payload.azp && !ORIGINS.has(String(payload.azp))) return null;
		return typeof payload.sub === "string" ? payload.sub : null;
	} catch {
		return null;
	}
}
const isLocal = (url: URL) => url.hostname === "localhost" || url.hostname === "127.0.0.1";

async function hashPassword(password: string, salt: Uint8Array) {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
	const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
	return b64(new Uint8Array(bits));
}
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
const randomToken = (n: number) => b64(crypto.getRandomValues(new Uint8Array(n)));

// the leaderboard: one row per player, added to after every finished online match
let tableReady = false;
async function table(db: D1Database) {
	if (tableReady) return;
	await db.prepare(`CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, name TEXT NOT NULL, wins INTEGER NOT NULL DEFAULT 0,
		matches INTEGER NOT NULL DEFAULT 0, kos INTEGER NOT NULL DEFAULT 0, parries INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL)`).run();
	tableReady = true;
}

export default {
	async fetch(request: Request, env: Env) {
		const url = new URL(request.url);
		if (url.pathname === "/games/botbattle") return Response.redirect(`${url.origin}/games/botbattle/`, 301);
		if (!url.pathname.startsWith(API + "/")) return new Response("Not found", { status: 404 });
		const path = url.pathname.slice(API.length);

		if (path === "/rooms" && request.method === "POST") {
			const auth = request.headers.get("authorization")?.replace(/^Bearer /, "");
			const user = await signedIn(auth, isLocal(url));
			if (!user) return json({ error: "Sign in to create a room." }, 401);
			const body = (await request.json().catch(() => ({}))) as { name?: string; password?: string };
			const checked = roomName(body.name);
			if ("error" in checked) return json(checked, 400);
			const password = String(body.password ?? "");
			if (password.length > 64) return json({ error: "Keep the password under 64 characters." }, 400);
			const room = env.ROOMS.get(env.ROOMS.idFromName(checked.key));
			const made = await room.create(checked.name, checked.key, password);
			return "error" in made ? json(made, 409) : json(made);
		}
		if (path === "/casual" && request.method === "POST") {
			const auth = request.headers.get("authorization")?.replace(/^Bearer /, "");
			const user = await signedIn(auth, isLocal(url));
			if (!user) return json({ error: "Sign in to play a casual match." }, 401);
			return json(await env.CASUAL.get(env.CASUAL.idFromName("casual")).find(user));
		}
		const ws = path.match(/^\/rooms\/([^/]+)\/ws$/);
		if (ws) {
			if (request.headers.get("upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
			const key = decodeURIComponent(ws[1]).trim().replace(/\s+/g, " ").toLowerCase();
			if (!/^[a-z0-9 ]{3,16}$/.test(key)) return new Response("No such room", { status: 404 });
			return env.ROOMS.get(env.ROOMS.idFromName(key)).fetch(request);
		}
		if (path === "/leaderboard" && request.method === "GET") {
			await table(env.DB);
			const { results } = await env.DB.prepare(
				"SELECT name, wins, matches, kos, parries FROM players ORDER BY wins DESC, matches ASC, kos DESC LIMIT 25").all();
			return json({ players: results });
		}
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

type Info = { name: string; key: string; salt: string; hash: string | null; invite: string; created: number; casual?: boolean };
type Player = { id: string; name: string; kind: string | null; variant: string | null; ready: boolean; ws: WebSocket; emoteAt: number };

export class Room extends DurableObject<Env> {
	info: Info | null = null;
	loaded = false;
	players: Player[] = [];          // signed in and in the room, oldest first
	host: string | null = null;
	lives = 3;
	match: { id: string; players: string[]; names: Map<string, string> } | null = null;

	async load() {
		if (!this.loaded) { this.info = (await this.ctx.storage.get<Info>("info")) ?? null; this.loaded = true; }
		return this.info;
	}

	// a new room, unless one by that name has players in it
	async create(name: string, key: string, password: string, casual = false) {
		await this.load();
		if (this.info && this.players.length) return { error: "That room is in use. Pick another name." };
		const salt = crypto.getRandomValues(new Uint8Array(16));
		this.info = { name, key, salt: b64(salt), hash: password ? await hashPassword(password, salt) : null, invite: randomToken(18), created: Date.now(), casual };
		await this.ctx.storage.put("info", this.info);
		await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
		this.lives = 3; this.match = null;
		return { name, key, invite: this.info.invite };
	}

	// for the Casual object: who's in the room, and whether a match is on
	async status() {
		const info = await this.load();
		return { exists: !!info, players: this.players.map(p => p.id), playing: !!this.match };
	}

	async fetch(request: Request) {
		const local = isLocal(new URL(request.url));
		const [client, server] = Object.values(new WebSocketPair());
		server.accept();
		let me: Player | null = null, joining = false;
		const hello = setTimeout(() => server.close(4001, "Too slow to sign in"), 10000);
		server.addEventListener("message", async event => {
			if (typeof event.data !== "string" || event.data.length > 8192) return;
			let msg: any;
			try { msg = JSON.parse(event.data); } catch { return; }
			if (!me) {
				if (msg.t !== "hello" || joining) return;
				joining = true;
				clearTimeout(hello);
				me = await this.join(server, msg, local);
				return;
			}
			this.handle(me, msg, event.data);
		});
		const gone = () => { clearTimeout(hello); if (me) this.leave(me); };
		server.addEventListener("close", gone);
		server.addEventListener("error", gone);
		return new Response(null, { status: 101, webSocket: client });
	}

	async join(ws: WebSocket, msg: any, local: boolean): Promise<Player | null> {
		const fail = (error: string) => { ws.send(JSON.stringify({ t: "error", error })); ws.close(4000, "refused"); return null; };
		const id = await signedIn(msg.token, local);
		if (!id) return fail("Sign in again to join.");
		const info = await this.load();
		if (!info) return fail("There's no room with that name.");
		const invited = typeof msg.invite === "string" && msg.invite === info.invite;
		if (info.hash && !invited) {
			if (typeof msg.password !== "string" || (await hashPassword(msg.password, unb64(info.salt))) !== info.hash) return fail("Wrong password.");
		}
		const again = this.players.find(p => p.id === id);
		if (again) { this.players = this.players.filter(p => p !== again); try { again.ws.close(4002, "joined elsewhere"); } catch { /* gone */ } }
		const most = info.casual ? CASUAL_PLAYERS : MAX_PLAYERS;
		if (this.players.length >= most) return fail(info.casual ? "Someone else got that match first. Try again." : "That room is full (three players).");
		if (this.match && !this.match.players.includes(id)) return fail("A match is on in that room. Try again when it ends.");
		const me: Player = { id, name: displayName(msg.name), kind: again?.kind ?? null, variant: again?.variant ?? null, ready: false, ws, emoteAt: 0 };
		this.players.push(me);
		if (!this.host) this.host = id;
		await this.ctx.storage.deleteAlarm();
		ws.send(JSON.stringify({ t: "welcome", id, room: info.name, key: info.key, invite: info.invite, casual: !!info.casual }));
		this.lobby();
		return me;
	}

	handle(me: Player, msg: any, raw: string) {
		const isHost = me.id === this.host;
		switch (msg.t) {
			case "pick":
				if (this.match || !KINDS.includes(msg.kind)) return;
				me.kind = msg.kind;
				me.variant = VARIANTS[msg.kind].includes(msg.variant) ? msg.variant : VARIANTS[msg.kind][0];
				me.ready = false; this.lobby(); return;
			case "ready":
				if (this.match || !me.kind) return;
				me.ready = !!msg.on;
				if (this.info?.casual && this.allReady()) { this.begin(); return; }     // casual: no host to press start
				this.lobby(); return;
			case "lives":
				if (!isHost || this.match || ![1, 2, 3, 5].includes(msg.n)) return;
				this.lives = msg.n; this.lobby(); return;
			case "start":
				if (isHost && this.allReady()) this.begin();
				return;
			case "in":         // a player's controls, for everyone else
				if (!this.match || !this.match.players.includes(me.id) || !Number.isInteger(msg.b)) return;
				this.send(me, { t: "in", id: me.id, b: msg.b & 0xffff }); return;
			case "snap":       // the host's state of the match, for the guests, passed on as it came
				if (isHost && this.match) this.send(me, raw); return;
			case "emote": {
				const now = Date.now();
				if (!Number.isInteger(msg.e) || msg.e < 0 || msg.e > 5 || now - me.emoteAt < 700) return;
				me.emoteAt = now;
				this.send(null, { t: "emote", id: me.id, e: msg.e }); return;
			}
			case "result":
				if (isHost && this.match) this.finish(msg); return;
			case "ping":
				me.ws.send('{"t":"pong"}'); return;
		}
	}

	allReady() {
		return !this.match && this.players.length >= 2 && this.players.every(p => p.kind && p.ready);
	}
	begin() {
		this.match = { id: randomToken(9), players: this.players.map(p => p.id), names: new Map(this.players.map(p => [p.id, p.name])) };
		this.send(null, { t: "start", mid: this.match.id, lives: this.lives, host: this.host,
			players: this.players.map(p => ({ id: p.id, name: p.name, kind: p.kind, variant: p.variant })) });
		this.lobby();
	}

	// the host reports how the match went; it goes on the leaderboard once
	async finish(msg: any) {
		const m = this.match!;
		this.match = null;
		for (const p of this.players) p.ready = false;
		this.lobby();
		if (!Array.isArray(msg.stats)) return;
		const seen = new Set<string>();
		const stats = msg.stats.filter((s: any) => s && m.players.includes(s.id) && !seen.has(s.id) && seen.add(s.id));
		if (stats.length < 2) return;
		const db = this.env.DB;
		await table(db);
		const n = (v: unknown) => Math.max(0, Math.min(99, Math.floor(Number(v) || 0)));
		await db.batch(stats.map((s: any) => db.prepare(
			`INSERT INTO players (id, name, wins, matches, kos, parries, updated) VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6)
			 ON CONFLICT(id) DO UPDATE SET name = excluded.name, wins = wins + excluded.wins, matches = matches + 1,
			 kos = kos + excluded.kos, parries = parries + excluded.parries, updated = excluded.updated`)
			.bind(s.id, m.names.get(s.id) ?? "Player", s.id === msg.winner ? 1 : 0, n(s.kos), n(s.parries), Date.now())));
	}

	leave(me: Player) {
		if (!this.players.includes(me)) return;
		this.players = this.players.filter(p => p !== me);
		if (this.match?.players.includes(me.id)) {
			if (me.id === this.host) { this.match = null; this.send(null, { t: "abort", reason: "The host left, so the match ended." }); }
			else this.send(null, { t: "left", id: me.id });
		}
		if (this.host === me.id) this.host = this.players[0]?.id ?? null;
		if (!this.players.length) { this.match = null; this.ctx.storage.setAlarm(Date.now() + IDLE_MS); }
		this.lobby();
	}

	async alarm() {
		if (this.players.length) return;
		await this.ctx.storage.deleteAll();
		this.info = null;
	}

	lobby() {
		this.send(null, { t: "lobby", host: this.host, lives: this.lives, playing: !!this.match,
			players: this.players.map(p => ({ id: p.id, name: p.name, kind: p.kind, variant: p.variant, ready: p.ready })) });
	}
	send(except: Player | null, msg: unknown) {
		const data = typeof msg === "string" ? msg : JSON.stringify(msg);
		for (const p of this.players) if (p !== except) { try { p.ws.send(data); } catch { /* closing */ } }
	}
}
