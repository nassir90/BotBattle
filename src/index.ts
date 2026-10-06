// Requests that don't match a static asset end up here.
export default {
	fetch(request: Request) {
		const url = new URL(request.url);
		if (url.pathname === "/games/botbattle") {
			return Response.redirect(`${url.origin}/games/botbattle/`, 301);
		}
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler;
