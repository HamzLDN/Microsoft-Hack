import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { buildPortfolio } from "@/lib/server/portfolio";

export async function POST(req: Request) {
  try {
    return NextResponse.json(await buildPortfolio(await req.json(), currentUser()?.id));
  } catch (err) {
    return NextResponse.json({ error: `The data service is not reachable. Start it with python app.py in data-service. (${(err as Error).message})` }, { status: 503 });
  }
}
