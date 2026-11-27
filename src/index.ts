import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Cours de bourse",
		version: "1.0.0",
	});

	async init() {
		// Cours d'une action ou d'un ETF (données Yahoo Finance, différées)
		this.server.tool(
			"cours_action",
			"Donne le dernier cours connu d'une action ou d'un ETF à partir de son symbole Yahoo Finance (ex : AAPL, MC.PA pour LVMH, AIR.PA pour Airbus).",
			{ symbole: z.string().describe("Symbole Yahoo Finance, ex : MC.PA") },
			async ({ symbole }) => {
				const s = symbole.trim().toUpperCase();
				const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=1d`;
				const rep = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
				if (!rep.ok) {
					return { content: [{ type: "text", text: `Erreur ${rep.status} en interrogeant ${s}` }], isError: true };
				}
				const data: any = await rep.json();
				const meta = data?.chart?.result?.[0]?.meta;
				if (!meta || meta.regularMarketPrice == null) {
					return { content: [{ type: "text", text: `Symbole introuvable : ${s}` }], isError: true };
				}
				const prix = meta.regularMarketPrice;
				const veille = meta.chartPreviousClose;
				const variation = veille ? (((prix - veille) / veille) * 100).toFixed(2) + " %" : "n/d";
				const date = new Date(meta.regularMarketTime * 1000).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
				const texte = `${meta.longName ?? meta.shortName ?? s} (${s}) : ${prix} ${meta.currency}\nVariation depuis la clôture précédente : ${variation}\nDernière cotation : ${date} (${meta.exchangeName})`;
				return { content: [{ type: "text", text: texte }] };
			},
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
