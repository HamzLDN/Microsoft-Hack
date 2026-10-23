// Runs the full committee pipeline for one company (used when the drawer opens a company the review didn't cover).
import { NextResponse } from "next/server";
import { fitEvidence } from "@/lib/ai/analysts";
import { runIC } from "@/lib/ai/ic";
import { flask } from "@/lib/server/flask";
import type { Candidate, Evidence, Rule } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { candidate, rules, badYearLoss, client } = (await req.json()) as { candidate: Candidate; rules: Rule[]; badYearLoss: number; client: string };
  let evidence: Evidence[] = [];
  try { evidence = (await flask<{ evidence: Evidence[] }>(`/evidence/${candidate.ticker}`)).evidence; } catch {}
  const all = [...evidence, ...fitEvidence(candidate, rules, badYearLoss)];
  return NextResponse.json({ ic: await runIC(candidate, rules, all, client), evidence: all });
}
