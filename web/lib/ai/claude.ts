// Claude (Opus 5.5 by default) through the official Anthropic SDK, either directly or on Microsoft Foundry.
import Anthropic from "@anthropic-ai/sdk";
import AnthropicFoundry from "@anthropic-ai/foundry-sdk";

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
type Setup = { client: Anthropic; platform: "claude-api" | "foundry" };

function setup(): Setup | null {
  const e = process.env;
  const foundryUrl = e.ANTHROPIC_FOUNDRY_BASE_URL || (e.ORGANISER_API_ENDPOINT && /azure|foundry/i.test(e.ORGANISER_API_ENDPOINT) ? e.ORGANISER_API_ENDPOINT : "");
  const foundryKey = e.ANTHROPIC_FOUNDRY_API_KEY || e.ORGANISER_API_KEY;
  if ((e.ANTHROPIC_FOUNDRY_RESOURCE || foundryUrl) && foundryKey) {
    const client = e.ANTHROPIC_FOUNDRY_RESOURCE
      ? new AnthropicFoundry({ apiKey: foundryKey, resource: e.ANTHROPIC_FOUNDRY_RESOURCE })
      : new AnthropicFoundry({ apiKey: foundryKey, baseURL: foundryUrl });
    return { client: client as unknown as Anthropic, platform: "foundry" };
  }
  // Only real Claude keys (sk-ant...) go to Claude; anything else on the organiser line is the hackathon gateway key
  const key = e.ANTHROPIC_API_KEY || (e.ORGANISER_API_KEY?.startsWith("sk-ant") ? e.ORGANISER_API_KEY : "");
  return key ? { client: new Anthropic({ apiKey: key }), platform: "claude-api" } : null;
}

export const claudeConfigured = () => setup() !== null;

/** Model for one analyst: ANALYST_MODEL_FUNDAMENTALS / _MARKETS / _FIT, else CLAUDE_MODEL, else Opus 5.5. */
export function modelFor(agent?: string) {
  const e = process.env;
  return (agent && e[`ANALYST_MODEL_${agent.toUpperCase()}`]) || e.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;
}

export async function claudeComplete(opts: {
  system: string;
  messages: Anthropic.MessageParam[];
  model?: string;
  effort?: Effort;
  schema?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<{ text: string; model: string; platform: string }> {
  const s = setup();
  if (!s) throw new Error("Claude is not configured");
  const model = opts.model || modelFor();
  const output_config = { effort: opts.effort ?? "low", ...(opts.schema ? { format: { type: "json_schema" as const, schema: opts.schema } } : {}) };
  const reqOpts = { timeout: opts.timeoutMs ?? 45000, maxRetries: 1 };
  const base = { model, max_tokens: 16000, system: opts.system, messages: opts.messages, output_config };
  // Server-side refusal fallback is a Claude API feature; on Foundry a refusal falls through to our data-only fallback.
  const res = s.platform === "claude-api"
    ? await s.client.beta.messages.create({ ...base, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }, reqOpts)
    : await s.client.messages.create(base, reqOpts);
  if (res.stop_reason === "refusal") throw new Error("Claude declined this request");
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  if (!text) throw new Error(`Claude returned no text (stop reason ${res.stop_reason})`);
  return { text, model: res.model, platform: s.platform };
}

/** JSON schema Claude must follow for an analyst's answer (structured outputs). */
export const ANALYST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["stance", "confidence", "points", "summary"],
  properties: {
    stance: { type: "string", enum: ["include", "exclude", "neutral"] },
    confidence: { type: "number" },
    summary: { type: "string" },
    points: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "polarity", "evidenceIds"],
        properties: { text: { type: "string" }, polarity: { type: "string", enum: ["pro", "con"] }, evidenceIds: { type: "array", items: { type: "string" } } },
      },
    },
  },
} as const;
