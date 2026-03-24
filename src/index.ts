
const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
	"Access-Control-Allow-Headers": "Authorization,User-Agent,X-Api-Key,X-CSRF-Token,X-Requested-With,Accept,Accept-Version,Content-Length,Content-MD5,Content-Type,Date,X-Api-Version,HTTP-Referer,X-Windowai-Title,X-Openrouter-Title,X-Title,X-Stainless-Lang,X-Stainless-Package-Version,X-Stainless-OS,X-Stainless-Arch,X-Stainless-Runtime,X-Stainless-Runtime-Version,X-Stainless-Retry-Count,X-Stainless-Timeout,X-Stainless-Helper-Method,Protection-Key,traceparent,tracestate,b3"
};

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method === "OPTIONS")
			return new Response(null, {
				headers: corsHeaders
			});

		const url = new URL(request.url);
		if (url.pathname.includes("/steel"))  return steel(request);
		if (url.pathname.includes("/get"))    return get(request, env);
		if (url.pathname.includes("/neat"))   return neat(request, env);
		if (url.pathname.includes("/armory")) return armory(request, env);
		return main(request, env);
	},
} satisfies ExportedHandler<Env>;

////////////////////////////////
// Routes

async function steel(request: Request) {
	const [, url] = request.url.split("steel/");

	if (!url) {
		return new Response("Missing 'url' parameter", { status: 400 });
	}

	try {
		const response = await fetch(decodeURIComponent(url), {
			headers: {
				"User-Agent": "Cloudflare-Worker-Proxy",
			},
		});

		const newResponse = new Response(response.body, response);

		for (const [name, value] of Object.entries(corsHeaders))
			newResponse.headers.set(name, value);
		newResponse.headers.set("Content-Type", "text/html; charset=utf-8");

		return newResponse;
	} catch (e) {
		return new Response("Failed to fetch target URL", { status: 500 });
	}
}

async function get(request: Request, env: Env) {
	const [, id] = request.url.split("get/");
	return new Response(await env.headache_kv.get(id), {
		headers: {
			"Content-Type": "application/json"
		}
	});
}

async function neat(request: Request, env: Env) {
	const [, id] = request.url.split("neat/");
	const value = await env.headache_kv.get(id);
	if (!value) return new Response(null, { status: 404 });
	// @ts-ignore
	const content = JSON.parse(value)?.messages?.find(({ role }) => role === "system")?.content
	if (!content) return new Response(null, { status: 403 });
	return new Response(content);
}

async function main(request: Request, env: Env) {
	const id = crypto.randomUUID();
	await env.headache_kv.put(id, await request.text(), { expirationTtl: 10 * 60 });

	const time = Math.floor(Date.now() / 1000);
	const url = request.url;
	const link = (ep: string) => `${url.endsWith("/") ? url : (url + "/")}${ep}/${id}`;
	const getLink = link("get");
	const neatLink = link("neat");
	const payload = [
		`Done! Request is saved and will be removed in 10 minutes.\n\n`,
		`[Parsed system prompt](${neatLink}) (\`${neatLink}\`)\n\n`,
		`[Raw request data](${getLink}) (\`${getLink}\`)`
	];
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			const send = (obj: any) => {
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
				);
			};

			for (const c of payload) {
				send({
					id: `gen-${time}-${id}"`,
					object: "chat.completion.chunk",
					choices: [{ delta: { content: c } }],
				});
				await new Promise(r => setTimeout(r, 400));
			}

			controller.enqueue(encoder.encode("data: [DONE]\n\n"));
			controller.close();
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			"Connection": "keep-alive",
			...corsHeaders
		},
	});
}

async function armory(request: Request, env: Env) {
	// type ArmoryItem = {
	// 	id: string,
	// 	summary: string,
	// 	icon: string,
	// 	url: string,
	// 	lastUpdate: string
	// };

	return new Response(JSON.stringify([]), {
		headers: {
			"Content-Type": "application/json"
		}
	});
}
