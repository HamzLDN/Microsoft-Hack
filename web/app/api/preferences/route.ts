import { NextResponse } from "next/server";
import { resolveUser } from "@/lib/server/auth";
import { db, save } from "@/lib/server/db";

export async function GET(req: Request) {
  const u = resolveUser(req);
  if (!u) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const list = db().prefs[u.id] ?? [];
  return NextResponse.json({ latest: list[list.length - 1] ?? null });
}

export async function PUT(req: Request) {
  const u = resolveUser(req);
  if (!u) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const data = await req.json();
  const d = db();
  (d.prefs[u.id] ??= []).push({ savedAt: new Date().toISOString(), data });
  d.prefs[u.id] = d.prefs[u.id].slice(-10);
  save();
  return NextResponse.json({ ok: true });
}
