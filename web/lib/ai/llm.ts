// One wrapper for every LLM call. Provider order: organiser key, then Azure OpenAI, then OpenAI.
import OpenAI, { AzureOpenAI } from "openai";
import { claudeComplete, claudeConfigured, modelFor } from "./claude";

type Provider = { name: string; model: string; client: OpenAI };

function providers(): Provider[] {
  const e = process.env;
  const list: Provider[] = [];
  const order = [(e.LLM_PROVIDER || "organiser").toLowerCase(), "organiser", "azure", "openai"];
  for (const name of Array.from(new Set(order))) {
    if (name === "organiser" && e.ORGANISER_API_KEY && e.ORGANISER_API_ENDPOINT) {
      const azure = /openai\.azure\.com|cognitiveservices\.azure\.com/.test(e.ORGANISER_API_ENDPOINT);
      list.push({
        name: "organiser",
        model: e.ORGANISER_MODEL || "gpt-4o-mini",
        client: azure
          ? new AzureOpenAI({ endpoint: e.ORGANISER_API_ENDPOINT, apiKey: e.ORGANISER_API_KEY, deployment: e.ORGANISER_MODEL, apiVersion: "2024-10-21" })
          : new OpenAI({ baseURL: e.ORGANISER_API_ENDPOINT, apiKey: e.ORGANISER_API_KEY }),
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
    try {
      const res = await p.client.chat.completions.create(
        { model: p.model, messages, temperature: 0, ...(json ? { response_format: { type: "json_object" as const } } : {}) },
        { timeout: timeoutMs, maxRetries: 0 },
      );
      const text = res.choices[0]?.message?.content ?? "";
      if (text) return { text, provider: p.name, model: p.model };
    } catch (err) {
      errors.push(`${p.name}: ${(err as Error).message}`);
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
