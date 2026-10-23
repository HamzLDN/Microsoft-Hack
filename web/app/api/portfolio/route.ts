import { NextResponse } from "next/server";
import { personalWeights } from "@/lib/learning";
import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { flask } from "@/lib/server/flask";

export async function POST(req: Request) {
  const body = await req.json();
  const u = currentUser();
  try {
    const defaults = await flask<Record<string, number>>(`/weights?horizon=${body.horizon ?? 9}&risk=${body.risk ?? 5}`);
    const weights = body.weights ?? personalWeights(defaults, u ? db().learned[u.id] : undefined);
    const p = await flask("/portfolio", { body: { ...body, weights }, timeoutMs: 90000 });
    return NextResponse.json(p);
  } catch (err) {
    return NextResponse.json({ error: `The data service is not reachable. Start it with python app.py in data-service. (${(err as Error).message})` }, { status: 503 });
  }
}
