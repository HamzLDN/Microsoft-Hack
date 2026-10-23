import { NextResponse } from "next/server";
import { runCommittee } from "@/lib/ai/committee";
import { resolveUser } from "@/lib/server/auth";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { request, client } = await req.json();
  try {
    return NextResponse.json(await runCommittee(request, client, resolveUser(req)?.id));
  } catch (err) {
    return NextResponse.json({ error: `Committee review failed: ${(err as Error).message}` }, { status: 503 });
  }
}
