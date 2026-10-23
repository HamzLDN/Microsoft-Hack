import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { correctionRate } from "@/lib/learning";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const d = db();
  let evals = null;
  try { evals = JSON.parse(fs.readFileSync(path.join(process.cwd(), "eval-results.json"), "utf8")); } catch {}
  return NextResponse.json({ sessions: d.sessions ?? [], chats: (d.chats ?? []).slice(0, 150), stats: d.stats,
    correctionRate: correctionRate(d.parses), correctionsStored: d.corrections.length, corrections: d.corrections.slice(0, 20), evals });
}
