import { NextResponse } from "next/server";
import { clearSession, ensureDemoUser, login, register, resolveUser, sessionToken, setSession } from "@/lib/server/auth";

export async function GET(req: Request) {
  ensureDemoUser();
  const user = resolveUser(req);
  const token = req.headers.get("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice(7).trim() : undefined;
  return NextResponse.json({ user, token: user && token ? token : undefined });
}

export async function POST(req: Request) {
  const { action, email, password } = await req.json();
  const mobile = req.headers.get("x-mandate-client") === "mobile";
  try {
    if (action === "logout") {
      clearSession();
      return NextResponse.json({ user: null, token: null });
    }
    const u = action === "register" ? register(email, password) : login(email, password);
    setSession(u.id);
    const user = { id: u.id, email: u.email };
    return NextResponse.json({ user, token: mobile ? sessionToken(u.id) : undefined });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
