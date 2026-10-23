// One wrapper for every LLM call. Default: the hackathon's Azure OpenAI gateway running gpt-6.1-sol.
// Fallbacks (only if configured): another Azure OpenAI deployment, then OpenAI.
import OpenAI, { AzureOpenAI } from "openai";

type Provider = { name: string; model: string; client: OpenAI };

const HACKATHON_ENDPOINT = "https://app-uoaihack2ix6ak.azurewebsites.net";
export const HACKATHON_MODEL = "gpt-6.1-sol";
const HACKATHON_API_VERSION = "2024-12-01-preview";

function providers(): Provider[] {
  const e = process.env;
  const list: Provider[] = [];
  // A key on the OPENAI_API_KEY line that isn't an OpenAI key (those start with sk-) is the hackathon gateway key
  const hackKey = e.ORGANISER_API_KEY || (e.OPENAI_API_KEY && !e.OPENAI_API_KEY.startsWith("sk-") ? e.OPENAI_API_KEY : "");
  if (hackKey) {
    const endpoint = e.ORGANISER_API_ENDPOINT || HACKATHON_ENDPOINT;
    const azure = Boolean(e.ORGANISER_API_VERSION) || /azure\.com|azurewebsites\.net/.test(endpoint);
    list.push({
      name: "hackathon gateway",
      model: e.ORGANISER_MODEL || HACKATHON_MODEL,
      // No fixed deployment: the client routes by each request's model, so analysts can use different models
      client: azure
        ? new AzureOpenAI({ endpoint, apiKey: hackKey, apiVersion: e.ORGANISER_API_VERSION || HACKATHON_API_VERSION })
        : new OpenAI({ baseURL: endpoint, apiKey: hackKey }),
    });
  }
  if (e.AZURE_OPENAI_API_KEY && e.AZURE_OPENAI_ENDPOINT && e.AZURE_OPENAI_DEPLOYMENT) {
    list.push({ name: "azure", model: e.AZURE_OPENAI_DEPLOYMENT,
      client: new AzureOpenAI({ endpoint: e.AZURE_OPENAI_ENDPOINT, apiKey: e.AZURE_OPENAI_API_KEY, apiVersion: HACKATHON_API_VERSION }) });
  }
  if (e.OPENAI_API_KEY?.startsWith("sk-")) {
    list.push({ name: "openai", model: e.OPENAI_MODEL || "gpt-4o-mini", client: new OpenAI({ apiKey: e.OPENAI_API_KEY }) });
  }
  return list;
}

export const llmConfigured = () => providers().length > 0;

/** Model for one analyst: ANALYST_MODEL_FUNDAMENTALS / _MARKETS / _FIT, else the provider default (gpt-6.1-sol). */
const modelFor = (p: Provider, agent?: string) => (agent && process.env[`ANALYST_MODEL_${agent.toUpperCase()}`]) || p.model;

type CallOpts = { agent?: string; schema?: Record<string, unknown> };

/** Drops a parameter the model refused (e.g. structured outputs on an older model) so the call can be retried. */
function relax(params: Record<string, unknown>, msg: string): Record<string, unknown> | null {
  const rf = params.response_format as { type?: string } | undefined;
  if (/response_format|json_schema|json_object/i.test(msg) && rf?.type === "json_schema") return { ...params, response_format: { type: "json_object" } };
  if (/response_format|json_object/i.test(msg) && rf) { const { response_format, ...rest } = params; return rest; }
  if (/max_completion_tokens/i.test(msg) && "max_completion_tokens" in params) { const { max_completion_tokens, ...rest } = params; return rest; }
  return null;
}

async function complete(messages: OpenAI.ChatCompletionMessageParam[], json: boolean, timeoutMs: number, opts: CallOpts = {}) {
  const errors: string[] = [];
  for (const p of providers()) {
    const model = modelFor(p, opts.agent);
    // gpt-6.1-sol only accepts the default temperature, so none is sent
    let params: Record<string, unknown> = {
      model, messages, max_completion_tokens: 16000,
      ...(json ? { response_format: opts.schema ? { type: "json_schema", json_schema: { name: "answer", strict: true, schema: opts.schema } } : { type: "json_object" } } : {}),
    };
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await p.client.chat.completions.create(params as unknown as OpenAI.ChatCompletionCreateParamsNonStreaming, { timeout: Math.max(timeoutMs, 60000), maxRetries: 1 });
        const text = res.choices[0]?.message?.content ?? "";
        if (text) return { text, provider: p.name, model: res.model || model };
        errors.push(`${p.name}: empty reply (${res.choices[0]?.finish_reason})`);
        break;
      } catch (err) {
        const msg = (err as Error).message;
        const next = relax(params, msg);
        if (next) { params = next; continue; }
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

export async function callTextWithTools(
  messages: OpenAI.ChatCompletionMessageParam[],
  tools: OpenAI.ChatCompletionTool[],
  onTool: (name: string, args: Record<string, unknown>) => Promise<string>,
  timeoutMs = 20000,
): Promise<string> {
  const errors: string[] = [];
  for (const p of providers()) {
    try {
      const convo: OpenAI.ChatCompletionMessageParam[] = [...messages];
      for (let step = 0; step < 6; step++) {
        const res = await p.client.chat.completions.create(
          { model: p.model, messages: convo, tools, max_completion_tokens: 16000 },
          { timeout: Math.max(timeoutMs, 60000), maxRetries: 1 },
        );
        const msg = res.choices[0]?.message;
        if (!msg) break;
        const toolCalls = msg.tool_calls;
        if (toolCalls?.length) {
          convo.push(msg);
          for (const tc of toolCalls) {
            if (tc.type !== "function") continue;
            const args = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>;
            const content = await onTool(tc.function.name, args);
            convo.push({ role: "tool", tool_call_id: tc.id, content });
          }
          continue;
        }
        if (msg.content) return msg.content;
        break;
      }
    } catch (err) {
      errors.push(`${p.name}: ${(err as Error).message}`);
    }
  }
  throw new Error(errors.length ? `All LLM providers failed. ${errors.join(" | ")}` : "No LLM provider configured");
}
