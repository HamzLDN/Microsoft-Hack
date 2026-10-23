import type OpenAI from "openai";
import { callTextWithTools } from "@/lib/ai/llm";
import { callMcpTool } from "./client";

const MCP_TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_universe",
      description: "Fuzzy match a company or ETF name to Mandate tickers.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_quote",
      description: "Current price for a ticker in Mandate's universe.",
      parameters: { type: "object", properties: { ticker: { type: "string" } }, required: ["ticker"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_metrics",
      description: "Volatility, returns and fundamentals for a ticker.",
      parameters: { type: "object", properties: { ticker: { type: "string" } }, required: ["ticker"] },
    },
  },
  {
    type: "function",
    function: {
      name: "data_health",
      description: "Which market data sources are active.",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  // A failing tool is reported to the model instead of failing the whole answer
  try {
    const out = await callMcpTool(name, args);
    return typeof out === "string" ? out : JSON.stringify(out);
  } catch (err) {
    return JSON.stringify({ error: `${name} is unavailable right now: ${(err as Error).message}. Answer without it and do not invent numbers.` });
  }
}

/** LLM reply that may call server-side MCP tools (same process as Help chat). */
export async function callTextWithMcp(messages: OpenAI.ChatCompletionMessageParam[], timeoutMs = 20000): Promise<string> {
  return callTextWithTools(messages, MCP_TOOLS, runTool, timeoutMs);
}
