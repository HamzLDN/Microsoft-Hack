import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { callJSON, llmConfigured } from "@/lib/ai/llm";

export async function GET() {
  if (!llmConfigured()) return NextResponse.json({ ok: false, reason: "No LLM configured. Set ORGANISER_API_KEY, ORGANISER_API_ENDPOINT and ORGANISER_MODEL in .env." });
  const t = Date.now();
  try {
    const r = await callJSON('Reply with JSON {"ok": true}', "ping", 15000);
    return NextResponse.json({ ok: true, provider: r.provider, model: r.model, ms: Date.now() - t });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: (err as Error).message }, { status: 502 });
  }
}
