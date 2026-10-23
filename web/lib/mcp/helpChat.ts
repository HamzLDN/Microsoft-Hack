import { GLOSSARY, lookup } from "@/lib/ai/glossary";
import { stripDashes } from "@/lib/ai/guardrails";
import { llmConfigured } from "@/lib/ai/llm";
import { callTextWithMcp } from "./llmAgent";
import { formatQuoteReply, resolveAndQuote, wantsLiveMarketData } from "./dataTools";

type Msg = { role: "user" | "assistant"; content: string };

const STYLE =
  "Plain English for someone who is not an expert. Under 120 words. Bold the key term or figure with **double asterisks**. No dashes as punctuation.";

export async function answerHelpChat(q: string, context: string, messages: Msg[]): Promise<string> {
  if (wantsLiveMarketData(q)) {
    const data = await resolveAndQuote(q);
    if ("price" in data) return stripDashes(formatQuoteReply(data));
    if (data.suggestions?.length) {
      const list = data.suggestions.map((s) => `${s.ticker} (${s.name})`).join(", ");
      return stripDashes(`I couldn't tell which one you meant. Did you mean: **${list}**? Ask again with the ticker, for example **TIP**.`);
    }
    if (data.error && !llmConfigured()) {
      return stripDashes(data.error);
    }
  }

  const local = lookup(q);
  if (!llmConfigured()) {
    if (local) {
      const key = Object.keys(GLOSSARY).find((k) => GLOSSARY[k] === local);
      return stripDashes(`**${key}**: ${local}`);
    }
    return "I can explain metrics on screen, or fetch **live prices** for stocks and ETFs in Mandate (try **TIP** or **iShares TIPS Bond**).";
  }

  const sys = `You are the help assistant in Mandate, an investing app for individuals. Explain terms and what is on screen. Use this glossary as the source of truth:\n${Object.entries(GLOSSARY)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")}\nWhat the user is looking at: ${context}\nYou have MCP tools for market data: search_universe, get_quote, get_metrics, data_health. Always use get_quote for prices; never invent numbers. Never give personal financial advice. ${STYLE}`;
  const r = await callTextWithMcp([{ role: "system", content: sys }, ...messages.slice(-6)]);
  return stripDashes(r);
}
