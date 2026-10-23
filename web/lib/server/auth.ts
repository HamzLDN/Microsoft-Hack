import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db, save } from "./db";

const COOKIE = "mandate_session";
const SECRET = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET || "mandate-dev-secret";
// Seeded demo accounts (test credentials for the hackathon demo, also listed in the README)
export const DEMO_EMAIL = "demo@bettervest.app";
const DEMO_PASSWORD = "demo1234";
const DEMO_USERS = [
  { id: "demo", email: DEMO_EMAIL },
  { id: "john", email: "john.doe@bettervest.app" },
];

const hashPw = (pw: string, salt: string) => crypto.scryptSync(pw, salt, 32).toString("hex");
const sign = (v: string) => crypto.createHmac("sha256", SECRET).update(v).digest("hex").slice(0, 32);

export function ensureDemoUser() {
  const d = db();
  let added = false;
  for (const u of DEMO_USERS) {
    if (d.users.some((x) => x.email === u.email)) continue;
    const renamed = d.users.find((x) => x.id === u.id);
    if (renamed) { renamed.email = u.email; added = true; continue; } // demo account moved to the Bettervest address
    const salt = crypto.randomBytes(8).toString("hex");
    d.users.push({ id: u.id, email: u.email, salt, hash: hashPw(DEMO_PASSWORD, salt), createdAt: new Date().toISOString() });
    added = true;
  }
  if (added) save();
}

export function register(email: string, password: string) {
  const d = db();
  email = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.");
  if (password.length < 6) throw new Error("Use a password of at least 6 characters.");
  if (d.users.some((u) => u.email === email)) throw new Error("That email already has an account. Log in instead.");
  const salt = crypto.randomBytes(8).toString("hex");
  const user = { id: crypto.randomUUID(), email, salt, hash: hashPw(password, salt), createdAt: new Date().toISOString() };
  d.users.push(user);
  save();
  return user;
}

export function login(email: string, password: string) {
  ensureDemoUser();
  const u = db().users.find((x) => x.email === email.trim().toLowerCase());
  if (!u || !crypto.timingSafeEqual(Buffer.from(hashPw(password, u.salt)), Buffer.from(u.hash))) {
    throw new Error("That email and password don't match.");
  }
  return u;
}

export function sessionToken(userId: string) {
  const exp = Date.now() + 7 * 864e5;
  const v = `${userId}.${exp}`;
  return `${v}.${sign(v)}`;
}

export function userFromSessionToken(raw: string | null | undefined) {
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  if (!id || !exp || sign(`${id}.${exp}`) !== sig || Number(exp) < Date.now()) return null;
  const u = db().users.find((x) => x.id === id);
  return u ? { id: u.id, email: u.email } : null;
}

/** Web cookie session, or mobile Bearer token on API requests. */
export function resolveUser(req?: Request) {
  if (req) {
    const auth = req.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      const u = userFromSessionToken(auth.slice(7).trim());
      if (u) return u;
    }
  }
  return currentUser();
}

export function setSession(userId: string) {
  cookies().set(COOKIE, sessionToken(userId), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400 });
}

export function clearSession() {
  cookies().delete(COOKIE);
}

export function currentUser() {
  return userFromSessionToken(cookies().get(COOKIE)?.value);
}
