// Pass through to the Flask data service for quotes, history, universe, metrics and the risk preview.
import { NextResponse } from "next/server";
import { flask } from "@/lib/server/flask";

const ALLOWED = /^(quote|history|universe|metrics|news|evidence|risk-preview|weights|health|macro)(\/|$)/;

async function handle(req: Request, params: { path: string[] }) {
  const p = params.path.join("/");
  if (!ALLOWED.test(p)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const qs = new URL(req.url).search;
  try {
    const body = req.method === "POST" ? await req.json() : undefined;
    return NextResponse.json(await flask(`/${p}${qs}`, { method: req.method, body }));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 503 });
  }
}

export const GET = (req: Request, { params }: { params: { path: string[] } }) => handle(req, params);
export const POST = (req: Request, { params }: { params: { path: string[] } }) => handle(req, params);
