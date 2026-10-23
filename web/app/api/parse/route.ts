import { NextResponse } from "next/server";
import { callJSON, llmConfigured } from "@/lib/ai/llm";
import { applyMemory, cleanLlmRules, fewShot, formRules, keywordRules, mergeRules, PARSE_SYSTEM, similarCorrections } from "@/lib/ai/parser";
import { resolveUser } from "@/lib/server/auth";
import { db, save } from "@/lib/server/db";
import type { AppRule, FormInput } from "@/lib/types";

export async function POST(req: Request) {
  const { form } = (await req.json()) as { form: FormInput };
  const text = (form.freeText || "").trim();
  const d = db();
  let textRules: AppRule[] = [];
  let method = "none";
  const examples = similarCorrections(text, d.corrections);
  if (text) {
    textRules = keywordRules(text);
    method = "keywords";
    if (llmConfigured()) {
      try {
        const { data } = await callJSON(PARSE_SYSTEM + fewShot(examples), text, 30000);
        const llm = cleanLlmRules(data, text);
        if (llm.length) {
          // LLM first; keep keyword rules for anything the LLM missed
          textRules = [...llm, ...textRules.filter((k) => !llm.some((l) => l.field === k.field && JSON.stringify(l.value) === JSON.stringify(k.value)))];
          method = "llm";
        }
      } catch {
        /* keyword rules stand */
      }
    }
    textRules = applyMemory(textRules, text, d.corrections);
  }
  const rules = mergeRules(formRules(form), textRules);
  const u = resolveUser(req);
  d.parses.push({ userId: u?.id ?? "anon", parsed: rules.filter((r) => r.source === "text").length, corrected: 0, at: new Date().toISOString() });
  save();
  return NextResponse.json({ rules, method, examplesUsed: examples.length });
}
