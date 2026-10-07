// Bot Battle's server. The game page is a static asset; everything under /games/botbattle/api is handled here.
//   POST /api/rooms                 create a room (signed in): { name, password? } -> { key, name, invite }
//   POST /api/casual                a casual match (signed in): a room with someone waiting in it, or a new one -> { key, name }
//   GET  /api/rooms/<key>/ws        a room's WebSocket; the first message signs in and unlocks the room (see Room)
//   GET  /api/leaderboard           the top players
// Each room is a Durable Object named by its key (the name in lower case). It holds the password hash and the
// invite, the players in the lobby, and relays a match: everyone's controls to everyone, the host's state to guests.
// Rooms hibernate between messages and keep their state in storage; a player whose connection drops keeps their
// seat for 30 seconds, and the page reconnects by itself.
// Casual rooms are made by the Casual object (one for the whole game), which hands each player a room someone is
// waiting in, or a new one to wait in. They hold two players, and the match starts once both are ready.
// Players sign in with Clerk; their session tokens are checked against Clerk's public signing keys.
import { DurableObject } from "cloudflare:workers";
import { base64url, createRemoteJWKSet, jwtVerify } from "jose";
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
		// every room's state at once, then the choice in one go (nothing else can run in between)
		const rooms = [...this.open], states = await Promise.all(rooms.map(r => roomStub(this.env, r.key).status()));
		for (const [i, r] of rooms.entries()) {
			const s = states[i], now = Date.now();
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
			const made = await roomStub(this.env, key).create(name, key, "", true);
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
const b64 = base64url.encode, unb64 = base64url.decode;      // (jose's, already here for the sign-in tokens)
// a password against a room's stored hash, in constant time
async function passwordMatches(password: unknown, info: Info) {
	if (typeof password !== "string" || !info.hash) return false;
	const a = unb64(await hashPassword(password, unb64(info.salt))), b = unb64(info.hash);
	return a.length === b.length && crypto.subtle.timingSafeEqual(a, b);
}
// the signed-in player making a request (their bearer token), or null
const userFrom = (request: Request, url: URL) => signedIn(request.headers.get("authorization")?.replace(/^Bearer /, ""), isLocal(url));
const roomStub = (env: Env, key: string) => env.ROOMS.get(env.ROOMS.idFromName(key));
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
			const user = await userFrom(request, url);
			if (!user) return json({ error: "Sign in to create a room." }, 401);
			const body = (await request.json().catch(() => ({}))) as { name?: string; password?: string };
			const checked = roomName(body.name);
			if ("error" in checked) return json(checked, 400);
			const password = String(body.password ?? "");
			if (password.length > 64) return json({ error: "Keep the password under 64 characters." }, 400);
			const made = await roomStub(env, checked.key).create(checked.name, checked.key, password);
			return "error" in made ? json(made, 409) : json(made);
		}
		if (path === "/casual" && request.method === "POST") {
			const user = await userFrom(request, url);
			if (!user) return json({ error: "Sign in to play a casual match." }, 401);
			return json(await env.CASUAL.get(env.CASUAL.idFromName("casual")).find(user));
		}
		const ws = path.match(/^\/rooms\/([^/]+)\/ws$/);
		if (ws) {
			if (request.headers.get("upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
			const key = decodeURIComponent(ws[1]).trim().replace(/\s+/g, " ").toLowerCase();
			if (!/^[a-z0-9 ]{3,16}$/.test(key)) return new Response("No such room", { status: 404 });
			return roomStub(env, key).fetch(request);
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
// A seat in a room: a signed-in player, connected or (for a little while after their connection drops) not.
type Seat = { id: string; name: string; kind: string | null; variant: string | null; ready: boolean; away: number | null };
type Match = { id: string; players: string[]; names: [string, string][] };
type State = { seats: Seat[]; host: string | null; lives: number; match: Match | null; emptySince: number | null };
// what each WebSocket carries through hibernation: whose it is, once they've signed in
type Tag = { id?: string; local: boolean };
const GRACE_MS = 30 * 1000;              // a dropped player keeps their seat (and their place in a match) this long
const fresh = (): State => ({ seats: [], host: null, lives: 3, match: null, emptySince: null });
// closes that mean the player is gone: the page went away (1001), they left (4100, the page's own code), or the room
// refused them (other 4xxx). Anything else, 1000 included (a reconnecting socket gives up on a stalled attempt with
// 1000), is a dropped connection, and they get GRACE_MS to come back.
const leaving = (code: number) => code === 1001 || code >= 4000;

// A room uses WebSocket hibernation: Cloudflare holds the connections while the room sleeps, and the room's state
// lives in storage, so it survives being unloaded (and a deploy, after which everyone reconnects).
export class Room extends DurableObject<Env> {
	info: Info | null = null;
	state: State = fresh();
	loaded = false;
	emoteAt = new Map<string, number>();

	async load() {
		if (this.loaded) return this.info;
		this.info = (await this.ctx.storage.get<Info>("info")) ?? null;
		this.state = (await this.ctx.storage.get<State>("state")) ?? fresh();
		this.loaded = true;
		// back after a restart: seats whose connection didn't survive it count as dropped from now
		const now = Date.now();
		let changed = false;
		for (const s of this.state.seats) if (s.away === null && !this.socketsOf(s.id).length) { s.away = now; changed = true; }
		if (changed) { await this.save(); await this.wake(); }
		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));   // pings don't wake the room
		return this.info;
	}
	save() { return this.ctx.storage.put("state", this.state); }
	tag(ws: WebSocket): Tag { return (ws.deserializeAttachment() as Tag) ?? { local: false }; }
	socketsOf(id: string) { return this.ctx.getWebSockets().filter(ws => this.tag(ws).id === id); }
	seat(id: string) { return this.state.seats.find(s => s.id === id); }

	// a new room, unless one by that name has players in it
	async create(name: string, key: string, password: string, casual = false) {
		await this.load();
		if (this.info && this.state.seats.length) return { error: "That room is in use. Pick another name." };
		const salt = crypto.getRandomValues(new Uint8Array(16));
		this.info = { name, key, salt: b64(salt), hash: password ? await hashPassword(password, salt) : null, invite: randomToken(18), created: Date.now(), casual };
		this.state = { ...fresh(), emptySince: Date.now() };
		await this.ctx.storage.put("info", this.info);
		await this.save();
		await this.wake();
		return { name, key, invite: this.info.invite };
	}

	// for the Casual object: who's in the room, and whether a match is on
	async status() {
		const info = await this.load();
		return { exists: !!info, players: this.state.seats.map(p => p.id), playing: !!this.state.match };
	}

	async fetch(request: Request) {
		await this.load();
		const [client, server] = Object.values(new WebSocketPair());
		this.ctx.acceptWebSocket(server);
		server.serializeAttachment({ local: isLocal(new URL(request.url)) } satisfies Tag);
		setTimeout(() => { if (!this.tag(server).id) { try { server.close(4001, "Too slow to sign in"); } catch { /* gone */ } } }, 10000);
		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
		if (typeof data !== "string" || data.length > 8192) return;
		let msg: any;
		try { msg = JSON.parse(data); } catch { return; }
		await this.load();
		const tag = this.tag(ws);
		if (!tag.id) { if (msg.t === "hello") await this.join(ws, msg, tag.local); return; }
		const me = this.seat(tag.id);
		if (me) this.handle(me, msg, data);
	}
	async webSocketClose(ws: WebSocket, code: number) { await this.closed(ws, code); }
	async webSocketError(ws: WebSocket) { await this.closed(ws, 1006); }

	async join(ws: WebSocket, msg: any, local: boolean) {
		const fail = (error: string) => { ws.send(JSON.stringify({ t: "error", error })); ws.close(4000, "refused"); };
		const id = await signedIn(msg.token, local);
		if (!id) return fail("Sign in again to join.");
		const info = await this.load();
		if (!info) return fail("There's no room with that name.");
		const again = this.seat(id);
		// someone already seated here (reconnecting, or in another tab) doesn't need the password again
		const invited = typeof msg.invite === "string" && msg.invite === info.invite;
		if (info.hash && !invited && !again && !(await passwordMatches(msg.password, info))) return fail("Wrong password.");
		for (const old of this.socketsOf(id)) if (old !== ws) { try { old.close(4002, "joined elsewhere"); } catch { /* gone */ } }
		const S = this.state;
		if (!again) {
			const most = info.casual ? CASUAL_PLAYERS : MAX_PLAYERS;
			if (S.seats.length >= most) return fail(info.casual ? "Someone else got that match first. Try again." : "That room is full (three players).");
			if (S.match) return fail("A match is on in that room. Try again when it ends.");
			S.seats.push({ id, name: displayName(msg.name), kind: null, variant: null, ready: false, away: null });
		} else {
			again.away = null;
			if (S.match?.players.includes(id)) this.send(id, { t: "back", id });     // back in the match
		}
		ws.serializeAttachment({ id, local } satisfies Tag);
		S.host ??= id;
		S.emptySince = null;
		await this.save();
		ws.send(JSON.stringify({ t: "welcome", id, room: info.name, key: info.key, invite: info.invite, casual: !!info.casual, again: !!again }));
		this.lobby();
	}

	// a connection closed: gone for good, or dropped (then the seat waits GRACE_MS for them to come back)
	async closed(ws: WebSocket, code: number) {
		await this.load();
		const id = this.tag(ws).id;
		if (!id || this.socketsOf(id).some(o => o !== ws && o.readyState === WebSocket.OPEN)) return;   // they're connected again already
		const me = this.seat(id);
		if (!me) return;
		if (leaving(code)) { await this.leave(me); return; }
		me.away = Date.now();
		if (this.state.match?.players.includes(id)) this.send(id, { t: "away", id });
		await this.save();
		await this.wake();
		this.lobby();
	}

	handle(me: Seat, msg: any, raw: string) {
		const S = this.state, isHost = me.id === S.host;
		switch (msg.t) {
			case "pick":
				if (S.match || !KINDS.includes(msg.kind)) return;
				me.kind = msg.kind;
				me.variant = VARIANTS[msg.kind].includes(msg.variant) ? msg.variant : VARIANTS[msg.kind][0];
				me.ready = false; this.save(); this.lobby(); return;
			case "ready":
				if (S.match || !me.kind) return;
				me.ready = !!msg.on;
				if (this.info?.casual && this.allReady()) { this.begin(); return; }     // casual: no host to press start
				this.save(); this.lobby(); return;
			case "lives":
				if (!isHost || S.match || ![1, 2, 3, 5].includes(msg.n)) return;
				S.lives = msg.n; this.save(); this.lobby(); return;
			case "start":
				if (isHost && this.allReady()) this.begin();
				return;
			case "in":         // a player's controls, for everyone else
				if (!S.match || !S.match.players.includes(me.id) || !Number.isInteger(msg.b)) return;
				this.send(me.id, { t: "in", id: me.id, b: msg.b & 0xffff }); return;
			case "snap":       // the host's state of the match, for the guests, passed on as it came
				if (isHost && S.match) this.send(me.id, raw); return;
			case "emote": {
				const now = Date.now();
				if (!Number.isInteger(msg.e) || msg.e < 0 || msg.e > 5 || now - (this.emoteAt.get(me.id) ?? 0) < 700) return;
				this.emoteAt.set(me.id, now);
				this.send(null, { t: "emote", id: me.id, e: msg.e }); return;
			}
			case "result":
				if (isHost && S.match) this.finish(msg); return;
		}
	}

	allReady() {
		const seats = this.state.seats;
		return !this.state.match && seats.length >= 2 && seats.every(p => p.kind && p.ready && p.away === null);
	}
	begin() {
		const S = this.state;
		S.match = { id: randomToken(9), players: S.seats.map(p => p.id), names: S.seats.map(p => [p.id, p.name]) };
		this.save();
		this.send(null, { t: "start", mid: S.match.id, lives: S.lives, host: S.host,
			players: S.seats.map(p => ({ id: p.id, name: p.name, kind: p.kind, variant: p.variant })) });
		this.lobby();
	}

	// the host reports how the match went; it goes on the leaderboard once
	async finish(msg: any) {
		const m = this.state.match!;
		this.state.match = null;
		for (const p of this.state.seats) p.ready = false;
		await this.save();
		this.lobby();
		if (!Array.isArray(msg.stats)) return;
		const seen = new Set<string>(), names = new Map(m.names);
		const stats = msg.stats.filter((s: any) => s && m.players.includes(s.id) && !seen.has(s.id) && seen.add(s.id));
		if (stats.length < 2) return;
		const db = this.env.DB;
		await table(db);
		const n = (v: unknown) => Math.max(0, Math.min(99, Math.floor(Number(v) || 0)));
		await db.batch(stats.map((s: any) => db.prepare(
			`INSERT INTO players (id, name, wins, matches, kos, parries, updated) VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6)
			 ON CONFLICT(id) DO UPDATE SET name = excluded.name, wins = wins + excluded.wins, matches = matches + 1,
			 kos = kos + excluded.kos, parries = parries + excluded.parries, updated = excluded.updated`)
			.bind(s.id, names.get(s.id) ?? "Player", s.id === msg.winner ? 1 : 0, n(s.kos), n(s.parries), Date.now())));
	}

	async leave(me: Seat) {
		const S = this.state;
		if (!S.seats.includes(me)) return;
		S.seats = S.seats.filter(p => p !== me);
		if (S.match?.players.includes(me.id)) {
			if (me.id === S.host) { S.match = null; this.send(null, { t: "abort", reason: "The host left, so the match ended." }); }
			else this.send(null, { t: "left", id: me.id });
		}
		if (S.host === me.id) S.host = S.seats.find(p => p.away === null)?.id ?? S.seats[0]?.id ?? null;
		if (!S.seats.length) { S.match = null; S.emptySince = Date.now(); }
		await this.save();
		await this.wake();
		this.lobby();
	}

	// one alarm for everything that waits: the next dropped player's grace running out, or an empty room's end
	async wake() {
		const S = this.state, times = S.seats.filter(p => p.away !== null).map(p => p.away! + GRACE_MS);
		if (S.emptySince !== null) times.push(S.emptySince + IDLE_MS);
		if (times.length) await this.ctx.storage.setAlarm(Math.min(...times));
		else await this.ctx.storage.deleteAlarm();
	}
	async alarm() {
		await this.load();
		const now = Date.now(), S = this.state;
		for (const p of [...S.seats]) if (p.away !== null && now - p.away >= GRACE_MS) await this.leave(p);
		if (!S.seats.length && S.emptySince !== null && now - S.emptySince >= IDLE_MS) {
			await this.ctx.storage.deleteAll();
			this.info = null; this.state = fresh();
			return;
		}
		await this.wake();
	}

	lobby() {
		const S = this.state;
		this.send(null, { t: "lobby", host: S.host, lives: S.lives, playing: !!S.match,
			players: S.seats.map(p => ({ id: p.id, name: p.name, kind: p.kind, variant: p.variant, ready: p.ready, away: p.away !== null })) });
	}
	// to everyone signed in, except one player
	send(except: string | null, msg: unknown) {
		const data = typeof msg === "string" ? msg : JSON.stringify(msg);
		for (const ws of this.ctx.getWebSockets()) {
			const id = this.tag(ws).id;
			if (id && id !== except) { try { ws.send(data); } catch { /* closing */ } }
		}
	}
}
