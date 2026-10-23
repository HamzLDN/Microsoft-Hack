// One wrapper for every LLM call. Provider order: organiser key, then Azure OpenAI, then OpenAI.
import OpenAI, { AzureOpenAI } from "openai";
import { claudeComplete, claudeConfigured, modelFor } from "./claude";

type Provider = { name: string; model: string; client: OpenAI };

const HACKATHON_ENDPOINT = "https://app-uoaihack2ix6ak.azurewebsites.net";
const HACKATHON_MODEL = "gpt-6.1-sol";
const HACKATHON_API_VERSION = "2024-12-01-preview";

function providers(): Provider[] {
  const e = process.env;
  const list: Provider[] = [];
  const order = [(e.LLM_PROVIDER || "organiser").toLowerCase(), "organiser", "azure", "openai"];
  for (const name of Array.from(new Set(order))) {
    if (name === "organiser" && e.ORGANISER_API_KEY) {
      // Defaults follow the hackathon's example project: Azure OpenAI client, this gateway, gpt-6.1-sol
      const endpoint = e.ORGANISER_API_ENDPOINT || HACKATHON_ENDPOINT;
      const azure = Boolean(e.ORGANISER_API_VERSION) || /azure\.com|azurewebsites\.net/.test(endpoint);
      list.push({
        name: "organiser",
        model: e.ORGANISER_MODEL || HACKATHON_MODEL,
        // No fixed deployment: the client routes by each request's model, so analysts can use different models
        client: azure
          ? new AzureOpenAI({ endpoint, apiKey: e.ORGANISER_API_KEY, apiVersion: e.ORGANISER_API_VERSION || HACKATHON_API_VERSION })
          : new OpenAI({ baseURL: endpoint, apiKey: e.ORGANISER_API_KEY }),
      });
    }
    if (name === "azure" && e.AZURE_OPENAI_API_KEY && e.AZURE_OPENAI_ENDPOINT && e.AZURE_OPENAI_DEPLOYMENT) {
      list.push({ name: "azure", model: e.AZURE_OPENAI_DEPLOYMENT,
        client: new AzureOpenAI({ endpoint: e.AZURE_OPENAI_ENDPOINT, apiKey: e.AZURE_OPENAI_API_KEY, deployment: e.AZURE_OPENAI_DEPLOYMENT, apiVersion: "2024-10-21" }) });
    }
    if (name === "openai" && e.OPENAI_API_KEY) {
      list.push({ name: "openai", model: e.OPENAI_MODEL || "gpt-4o-mini", client: new OpenAI({ apiKey: e.OPENAI_API_KEY }) });
    }
  }
  return list;
}

const useClaude = () => (process.env.LLM_PROVIDER || "claude").toLowerCase() === "claude" && claudeConfigured();
export const llmConfigured = () => useClaude() || providers().length > 0;

type CallOpts = { agent?: string; schema?: Record<string, unknown> };

async function complete(messages: OpenAI.ChatCompletionMessageParam[], json: boolean, timeoutMs: number, opts: CallOpts = {}) {
  const errors: string[] = [];
  if (useClaude()) {
    try {
      const system = messages.filter((m) => m.role === "system").map((m) => String(m.content)).join("\n\n");
      const convo = messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) }));
      const r = await claudeComplete({ system, messages: convo, model: modelFor(opts.agent), schema: json ? opts.schema : undefined, timeoutMs: Math.max(timeoutMs, 45000) });
      return { text: r.text, provider: `claude (${r.platform})`, model: r.model };
    } catch (err) {
      errors.push(`claude: ${(err as Error).message}`);
    }
  }
  for (const p of providers()) {
    // Optional per-analyst model, e.g. ANALYST_MODEL_MARKETS, so each analyst can run on a different model
    const model = (opts.agent && process.env[`ANALYST_MODEL_${opts.agent.toUpperCase()}`]) || p.model;
    // Some models reject temperature or JSON mode; retry once without whatever they refused
    let extras: Record<string, unknown> = { temperature: 0, max_completion_tokens: 16000, ...(json ? { response_format: { type: "json_object" } } : {}) };
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await p.client.chat.completions.create({ model, messages, ...extras } as OpenAI.ChatCompletionCreateParamsNonStreaming, { timeout: Math.max(timeoutMs, 30000), maxRetries: 0 });
        const text = res.choices[0]?.message?.content ?? "";
        if (text) return { text, provider: p.name, model: res.model || model };
        break;
      } catch (err) {
        const msg = (err as Error).message;
        if (/temperature/i.test(msg) && "temperature" in extras) { const { temperature, ...rest } = extras; extras = rest; continue; }
        if (/response_format|json_object/i.test(msg) && "response_format" in extras) { const { response_format, ...rest } = extras; extras = rest; continue; }
        if (/max_completion_tokens/i.test(msg) && "max_completion_tokens" in extras) { const { max_completion_tokens, ...rest } = extras; extras = rest; continue; }
        errors.push(`${p.name}: ${msg}`);
        break;
      }
    }
  }
  throw new Error(errors.length ? `All LLM providers failed. ${errors.join(" | ")}` : "No LLM provider configured");
}

export async function callJSON(system: string, user: string, timeoutMs = 12000, opts: CallOpts = {}): Promise<{ data: unknown; provider: string; model: string }> {
  const r = await complete([{ role: "system", content: system }, { role: "user", content: user }], true, timeoutMs, opts);
  const cleaned = r.text.replace(/^```(?:json)?\s*|\s*```$/g, "");
  return { data: JSON.parse(cleaned), provider: r.provider, model: r.model };
}

export async function callText(messages: OpenAI.ChatCompletionMessageParam[], timeoutMs = 12000, opts: CallOpts = {}) {
  return complete(messages, false, timeoutMs, opts);
}
