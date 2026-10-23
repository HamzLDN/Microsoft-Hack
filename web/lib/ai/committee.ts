// Committee review: the three analysts review every holding and the closest misses, discuss, and the portfolio is rebuilt.
import crypto from "node:crypto";
import type { AnalystOutput, Candidate, Evidence, Portfolio, Rule } from "../types";
import { buildPortfolio, type PortfolioRequest } from "../server/portfolio";
import { db, save } from "../server/db";
import { flask } from "../server/flask";
import { fitEvidence, runAnalyst } from "./analysts";
import { committeeAdjustment, ORDER, runDebate, type Debate } from "./debate";

export type CommitteeItem = { ticker: string; name: string; round1: AnalystOutput[]; models: string[]; debate: Debate; adjustment: number; evidence: Evidence[];
  before: { status: string; amount: number; score: number }; after?: { status: string; amount: number; score: number } };
export type Change = { ticker: string; name: string; kind: "added" | "dropped" | "increased" | "decreased"; before: number; after: number; scoreBefore: number; scoreAfter: number; adjustment: number; reason: string; speaker: string };

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

const TITLES: Record<string, string> = { fundamentals: "Fundamentals analyst", markets: "Markets and news analyst", fit: "Client fit analyst" };

const cache = new Map<string, { at: number; result: Awaited<ReturnType<typeof runFresh>> }>();

export async function runCommittee(req: PortfolioRequest, client: string, userId?: string) {
  const key = JSON.stringify([req.rules, req.horizon, req.risk, req.maxHolding, req.overrides, req.weights, client]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3 * 3600e3) return { ...hit.result, cached: true };
  const result = await runFresh(req, client, userId);
  cache.set(key, { at: Date.now(), result });
  return result;
}

async function runFresh(req: PortfolioRequest, client: string, userId?: string) {
  const t0 = Date.now();
  const before = await buildPortfolio({ ...req, adjustments: undefined }, userId);
  const rules = req.rules as Rule[];
  const isFundOnly = (c: Candidate) => c.sector === "Bonds" || c.sector === "Cash";
  const held = before.holdings.filter((c) => !isFundOnly(c));
  const near = before.considered.filter((c) => c.status === "excluded" && c.mainReason.startsWith("Ranked")).slice(0, 4);
  const review = [...held, ...near];

  const items = await pool(review, 7, async (c): Promise<CommitteeItem> => {
    let evidence: Evidence[] = [];
    try { evidence = (await flask<{ evidence: Evidence[] }>(`/evidence/${c.ticker}`)).evidence; } catch {}
    const all = [...evidence, ...fitEvidence(c, rules, before.badYearLoss)];
    const runs = await Promise.all(ORDER.map((a) => runAnalyst(a, c, all, client)));
    const st = db().stats;
    for (const r of runs) {
      st.analystRuns++; if (r.attempts === 1) st.firstTryPass++; if (r.attempts === 2) st.retried++; if (r.output.fallback) st.fallbacks++;
      st.numbersChecked += r.numbersChecked; st.unsupportedBlocked += r.blocked;
    }
    const round1 = runs.map((r) => r.output);
    const debate = await runDebate(c, round1, all, client);
    return { ticker: c.ticker, name: c.name, round1, models: runs.map((r) => r.provider ?? "data rules"), debate, adjustment: committeeAdjustment(round1, debate), evidence: all,
      before: { status: c.status, amount: c.amount, score: c.score.total } };
  });

  const adjustments = Object.fromEntries(items.filter((x) => x.adjustment).map((x) => [x.ticker, x.adjustment]));
  const after = await buildPortfolio({ ...req, adjustments }, userId);
  const find = (p: Portfolio, t: string) => [...p.holdings, ...p.considered].find((c) => c.ticker === t);
  const changes: Change[] = [];
  for (const it of items) {
    const a = find(after, it.ticker);
    if (!a) continue;
    it.after = { status: a.status, amount: a.amount, score: a.score.total };
    const diff = a.amount - it.before.amount;
    const kind = it.before.status !== a.status ? (a.status === "included" ? "added" : "dropped") : Math.abs(diff) >= 300 ? (diff > 0 ? "increased" : "decreased") : null;
    if (!kind) continue;
    const positive = kind === "added" || kind === "increased";
    const turn = it.debate.turns.find((t) => (positive ? t.kind === "agree" : t.kind !== "agree"));
    const shift = it.debate.shifts.find((x) => (positive ? x.to !== "exclude" : x.to !== "include"));
    const reason = turn?.text ?? shift?.reason ?? (positive ? "The committee backed it more strongly than the companies around it." : "Trimmed to make room for companies the committee backed more strongly.");
    changes.push({ ticker: it.ticker, name: it.name, kind, before: it.before.amount, after: a.amount, scoreBefore: it.before.score, scoreAfter: a.score.total, adjustment: it.adjustment,
      reason, speaker: turn ? TITLES[turn.from] : shift ? TITLES[shift.agent] : "Committee" });
  }
  const order = { added: 0, dropped: 1, increased: 2, decreased: 3 };
  changes.sort((x, y) => order[x.kind] - order[y.kind] || Math.abs(y.after - y.before) - Math.abs(x.after - x.before));

  const session = { id: crypto.randomUUID().slice(0, 8), at: new Date().toISOString(), userId: userId ?? "anon", kind: "committee", client, durationMs: Date.now() - t0,
    items: items.map(({ evidence, ...rest }) => rest), changes, adjustments, badYearLoss: { before: before.badYearLoss, after: after.badYearLoss } };
  const d = db();
  d.sessions = [session, ...(d.sessions ?? [])].slice(0, 30);
  save();
  return { portfolio: after, changes, items, sessionId: session.id, adjustments, durationMs: session.durationMs };
}
