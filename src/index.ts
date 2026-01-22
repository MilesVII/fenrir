
const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
	"Access-Control-Allow-Headers": "Authorization,User-Agent,X-Api-Key,X-CSRF-Token,X-Requested-With,Accept,Accept-Version,Content-Length,Content-MD5,Content-Type,Date,X-Api-Version,HTTP-Referer,X-Windowai-Title,X-Openrouter-Title,X-Title,X-Stainless-Lang,X-Stainless-Package-Version,X-Stainless-OS,X-Stainless-Arch,X-Stainless-Runtime,X-Stainless-Runtime-Version,X-Stainless-Retry-Count,X-Stainless-Timeout,X-Stainless-Helper-Method,Protection-Key,traceparent,tracestate,b3"
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method === "OPTIONS")
			return new Response(null, {
				headers: corsHeaders
			});
		if (request.url.includes("get/")) {
			const [, id] = request.url.split("get/");
			return new Response(await env.headache_kv.get(id), {
				headers: {
					"Content-Type": "application/json"
				}
			});
		}
		if (request.url.includes("neat/")) {
			const [, id] = request.url.split("neat/");
			const value = await env.headache_kv.get(id);
			if (!value) return new Response(null, { status: 404 });
			// @ts-ignore
			const content = JSON.parse(value)?.messages?.find(({ role }) => role === "system")?.content
			if (!content) return new Response(null, { status: 403 });
			return new Response(content);
		}

		const id = crypto.randomUUID();
		await env.headache_kv.put(id, await request.text(), { expirationTtl: 10 * 60 });

		const time = Math.floor(Date.now() / 1000);
		const url = request.url;
		const link = (ep: string) => `${url.endsWith("/") ? url : (url + "/")}${ep}/${id}`;
		const getLink = link("get");
		const neatLink = link("neat");
		const payload = [
			`Done! Request is saved and will be removed in 10 minutes.\n\n`,
			`[Parsed system prompt](${neatLink})\n\n`,
			`[Raw request data](${getLink})`
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
	},
} satisfies ExportedHandler<Env>;
