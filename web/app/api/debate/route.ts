import { NextResponse } from "next/server";
import { runDebate } from "@/lib/ai/debate";
import type { AnalystOutput, Candidate, Evidence } from "@/lib/types";

export async function POST(req: Request) {
  const { candidate, round1, evidence, client } = (await req.json()) as { candidate: Candidate; round1: AnalystOutput[]; evidence: Evidence[]; client: string };
  return NextResponse.json(await runDebate(candidate, round1, evidence, client));
}
