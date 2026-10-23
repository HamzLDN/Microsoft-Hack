import { GLOSSARY, lookupFollowUp } from "@/lib/ai/glossary";
import { stripDashes } from "@/lib/ai/guardrails";
import { llmConfigured } from "@/lib/ai/llm";
import { formatQuoteReply, resolveAndQuote, wantsLiveMarketData } from "./dataTools";
import { callTextWithMcp } from "./llmAgent";

type Msg = { role: "user" | "assistant"; content: string };

const STYLE =
  "Plain English for someone who is not an expert. Under 120 words. Bold the key term or figure with **double asterisks**. No dashes as punctuation.";

const GREETING = /^(hi|hello|hey|yo|test|ok|okay|thanks|thank you|sure|yes)\b/i;

function glossaryAnswer(q: string, earlier: string[] = []): string | null {
  const local = lookupFollowUp(q, earlier);
  if (!local) return null;
  const key = Object.keys(GLOSSARY).find((k) => GLOSSARY[k] === local) ?? "That term";
  return stripDashes(`**${key}**: ${local}`);
}

/** When the model is offline, still answer from the screen context and the glossary. */
function offlineReply(q: string, context: string, earlier: string[] = []): string {
  if (GREETING.test(q.trim())) {
    return "I'm the Bettervest assistant. Ask what a term means, or name a stock or ETF and I'll look up the price. Try **volatility** or **iShares TIPS Bond**.";
  }
  const loss = context.match(/Bad year loss (-?[\d.]+)/);
  if (loss && /bad year/i.test(q)) {
    const n = Math.abs(Math.round(Number(loss[1])));
    return `**Bad year loss** on this portfolio is **$${n.toLocaleString("en-US")}**. That is the loss we estimate in a rough year, from the mix you hold.`;
  }
  if (/holding|what do i own|in my portfolio|what am i holding/i.test(q) && context.includes("Holdings:")) {
    const hold = context.split("Holdings:")[1]?.split("Rules:")[0]?.trim();
    if (hold) return `You currently hold ${hold}`;
  }
  const gloss = glossaryAnswer(q, earlier);
  if (gloss) return gloss;
  return "I can explain terms on screen and look up prices for stocks and ETFs in Bettervest. Try **volatility** or **TIP**.";
}

export async function answerHelpChat(q: string, context: string, messages: Msg[]): Promise<string> {
  let quoted: string | null = null;
  try {
    const data = await resolveAndQuote(q);
    if (data && "price" in data) quoted = stripDashes(formatQuoteReply(data));
    else if (data?.suggestions?.length && (wantsLiveMarketData(q) || q.trim().split(/\s+/).length <= 8)) {
      const list = data.suggestions.map((s) => `${s.ticker} (${s.name})`).join(", ");
      return stripDashes(`I couldn't tell which one you meant. Did you mean: **${list}**? Ask again with the ticker, for example **TIP**.`);
    } else if (data && "error" in data && data.error && wantsLiveMarketData(q) && !llmConfigured()) {
      return stripDashes(data.error);
    }
  } catch (err) {
    console.error("market lookup failed:", (err as Error).message);
  }
  if (quoted) return quoted;

  if (llmConfigured()) {
    try {
      const sys = `You are the main assistant in Bettervest, an investing app for individuals. Answer the user's question directly first. Explain terms and what is on screen. Use this glossary as the source of truth:\n${Object.entries(GLOSSARY)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")}\nWhat the user is looking at: ${context}\nYou have MCP tools for market data: search_universe, get_quote, get_metrics, data_health. Always use get_quote for prices; never invent numbers. Use US dollars in examples. Never give personal financial advice. ${STYLE}`;
      const r = await callTextWithMcp([{ role: "system", content: sys }, ...messages.slice(-6)]);
      return stripDashes(r);
    } catch (err) {
      console.error("main assistant model failed:", (err as Error).message);
    }
  }

  return offlineReply(q, context, messages.slice(0, -1).map((m) => m.content));
}
