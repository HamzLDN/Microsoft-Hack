import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { correctionRate } from "@/lib/learning";
import { currentUser } from "@/lib/server/auth";
import { db, save } from "@/lib/server/db";

export async function GET() {
  const u = currentUser();
  const d = db();
  let evals = null;
  try {
    evals = JSON.parse(fs.readFileSync(path.join(process.cwd(), "eval-results.json"), "utf8"));
  } catch {}
  return NextResponse.json({
    correctionRate: correctionRate(d.parses),
    correctionsStored: d.corrections.length,
    learned: u ? d.learned[u.id] ?? null : null,
    stats: d.stats,
    evals,
  });
}

export async function DELETE() {
  const u = currentUser();
  if (u) {
    delete db().learned[u.id];
    save();
  }
  return NextResponse.json({ ok: true });
}
