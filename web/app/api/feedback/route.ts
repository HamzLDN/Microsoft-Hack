import { NextResponse } from "next/server";
import { applySwipe } from "@/lib/learning";
import { currentUser } from "@/lib/server/auth";
import { db, save } from "@/lib/server/db";

export async function POST(req: Request) {
  const { kind, before, after, context } = await req.json();
  const u = currentUser();
  const uid = u?.id ?? "anon";
  const d = db();
  d.feedback.push({ userId: uid, kind, before, after, context, createdAt: new Date().toISOString() });

  if (kind.startsWith("rule_")) {
    const mine = d.parses.filter((p) => p.userId === uid);
    if (mine.length) mine[mine.length - 1].corrected++;
    if ((kind === "rule_kind_toggle" || kind === "rule_edit") && after?.quote) {
      const phrase = String(after.quote);
      const rule = { field: after.field, kind: after.kind, value: after.value, text: after.text, op: after.op };
      const hit = d.corrections.find((c) => c.phrase.toLowerCase() === phrase.toLowerCase() && c.rule.field === rule.field);
      if (hit && JSON.stringify(hit.rule) === JSON.stringify(rule)) hit.timesConfirmed++;
      else if (hit) Object.assign(hit, { rule, timesConfirmed: 1 });
      else d.corrections.push({ phrase, rule, timesConfirmed: 1, updatedAt: new Date().toISOString() });
    }
  }
  if (kind === "swipe" && Array.isArray(context?.parts)) {
    d.learned[uid] = applySwipe(d.learned[uid] ?? { weightAdjust: {}, notes: [] }, Boolean(after?.own), context.parts);
  }
  if (kind === "weight_change" && after?.weights) {
    d.learned[uid] = { weightAdjust: after.adjust ?? {}, notes: ["You set your own score weights"] };
  }
  save();
  return NextResponse.json({ ok: true, learned: d.learned[uid] ?? null });
}
