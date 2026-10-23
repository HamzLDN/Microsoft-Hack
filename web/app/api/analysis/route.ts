import { NextResponse } from "next/server";
import { fitEvidence, runAnalyst } from "@/lib/ai/analysts";
import { db, save } from "@/lib/server/db";
import { flask } from "@/lib/server/flask";
import type { AgentName, Candidate, Evidence, Rule } from "@/lib/types";

export async function POST(req: Request) {
  const { agent, candidate, rules, badYearLoss, client } = (await req.json()) as {
    agent: AgentName; candidate: Candidate; rules: Rule[]; badYearLoss: number; client: string;
  };
  let evidence: Evidence[] = [];
  try {
    evidence = (await flask<{ evidence: Evidence[] }>(`/evidence/${candidate.ticker}`)).evidence;
  } catch {
    /* fit analyst can still run on rule checks */
  }
  const all = [...evidence, ...fitEvidence(candidate, rules, badYearLoss)];
  const r = await runAnalyst(agent, candidate, all, client);
  const s = db().stats;
  s.analystRuns++;
  if (r.attempts === 1) s.firstTryPass++;
  if (r.attempts === 2) s.retried++;
  if (r.output.fallback) s.fallbacks++;
  s.numbersChecked += r.numbersChecked;
  s.unsupportedBlocked += r.blocked;
  save();
  return NextResponse.json({ ...r, evidence: all });
}
