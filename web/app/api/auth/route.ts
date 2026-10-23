import { NextResponse } from "next/server";
import { clearSession, currentUser, ensureDemoUser, login, register, setSession } from "@/lib/server/auth";

export async function GET() {
  ensureDemoUser();
  return NextResponse.json({ user: currentUser() });
}

export async function POST(req: Request) {
  const { action, email, password } = await req.json();
  try {
    if (action === "logout") {
      clearSession();
      return NextResponse.json({ user: null });
    }
    const u = action === "register" ? register(email, password) : login(email, password);
    setSession(u.id);
    return NextResponse.json({ user: { id: u.id, email: u.email } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
