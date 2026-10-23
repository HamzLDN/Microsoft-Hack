// Committee review: Bull, Bear and the Judge review every holding, the closest misses and any rule breakers,
// through the 4-phase pipeline in ic.ts. Verdicts change the portfolio, which is then rebuilt.
import crypto from "node:crypto";
import type { AnalystOutput, Candidate, Evidence, Portfolio, Rule } from "../types";
import { buildPortfolio, type PortfolioRequest } from "../server/portfolio";
import { db, save } from "../server/db";
import { flask } from "../server/flask";
import { fitEvidence } from "./analysts";
import { runIC, stancesOf, verdictEffect, type IC } from "./ic";

export type CommitteeItem = { ticker: string; name: string; ic: IC; models: string[]; adjustment: number; out: boolean; evidence: Evidence[];
  /** Kept in the shape the dashboard's vote badges read */
  debate: { finalStances: Record<string, AnalystOutput["stance"]>; shifts: unknown[] };
  before: { status: string; amount: number; score: number }; after?: { status: string; amount: number; score: number } };
export type Change = { ticker: string; name: string; kind: "added" | "dropped" | "increased" | "decreased"; before: number; after: number; scoreBefore: number; scoreAfter: number; adjustment: number; reason: string; speaker: string };

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}


const cache = new Map<string, { at: number; result: Awaited<ReturnType<typeof runFresh>> }>();

export async function runCommittee(req: PortfolioRequest, client: string, userId?: string) {
  const key = JSON.stringify([req.rules, req.horizon, req.risk, req.maxHolding, req.overrides, req.weights, req.amount, client]);
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
  const near = before.considered.filter((c) => c.status === "excluded" && c.mainReason.startsWith("Ranked")).slice(0, 3);
  // Two rule breakers go through the pipeline too, so the compliance circuit breaker is visible (no AI calls: blocked instantly)
  const breakers = before.considered.filter((c) => c.mainReason.startsWith("Fails")).slice(0, 2);
  const review = [...held, ...near, ...breakers];

  const items = await pool(review, 7, async (c): Promise<CommitteeItem> => {
    let evidence: Evidence[] = [];
    try { evidence = (await flask<{ evidence: Evidence[] }>(`/evidence/${c.ticker}`)).evidence; } catch {}
    const all = [...evidence, ...fitEvidence(c, rules, before.badYearLoss)];
    const ic = await runIC(c, rules, all, client);
    const st = db().stats;
    const theses = Object.values(ic.theses);
    st.analystRuns += theses.length;
    st.fallbacks += theses.filter((t) => t?.fallback).length;
    st.numbersChecked += ic.numbersChecked;
    if (ic.halted?.code === "DATA_INTEGRITY_FAIL") st.unsupportedBlocked++;
    const fx = verdictEffect(ic, c.status === "included");
    return { ticker: c.ticker, name: c.name, ic, models: ic.models, adjustment: fx.adjustment, out: fx.out, evidence: all,
      debate: { finalStances: stancesOf(ic), shifts: [] }, before: { status: c.status, amount: c.amount, score: c.score.total } };
  });

  const adjustments = Object.fromEntries(items.filter((x) => x.adjustment).map((x) => [x.ticker, x.adjustment]));
  const outs = Object.fromEntries(items.filter((x) => x.out).map((x) => [x.ticker, "out"]));
  const after = await buildPortfolio({ ...req, adjustments, overrides: { ...(req.overrides ?? {}), ...outs } }, userId);
  const find = (p: Portfolio, t: string) => [...p.holdings, ...p.considered].find((c) => c.ticker === t);
  const changes: Change[] = [];
  for (const it of items) {
    const a = find(after, it.ticker);
    if (!a) continue;
    it.after = { status: a.status, amount: a.amount, score: a.score.total };
    const diff = a.amount - it.before.amount;
    const minMove = Math.max(100, (req.amount ?? 100_000) * 0.003);
    const kind = it.before.status !== a.status ? (a.status === "included" ? "added" : "dropped") : Math.abs(diff) >= minMove ? (diff > 0 ? "increased" : "decreased") : null;
    if (!kind) continue;
    const v = it.ic.verdict;
    const anyBuy = items.some((x) => x.ic.verdict.decision === "BUY");
    const reason = it.ic.halted ? it.ic.halted.reason
      : v.decision === "HOLD" && (kind === "decreased" || kind === "increased")
        ? `HOLD. ${kind === "decreased" ? (anyBuy ? "Trimmed to make room for companies the Judge rated BUY." : "Resized as the money from the companies the Judge sold was spread across the portfolio.") : "Resized as the portfolio rebalanced after the verdicts."}`
        : `${v.decision}. ${v.reasoning}`;
    changes.push({ ticker: it.ticker, name: it.name, kind, before: it.before.amount, after: a.amount, scoreBefore: it.before.score, scoreAfter: a.score.total, adjustment: it.adjustment,
      reason, speaker: it.ic.halted ? `Circuit breaker (${it.ic.halted.code})` : "Judge" });
  }
  const order = { added: 0, dropped: 1, increased: 2, decreased: 3 };
  changes.sort((x, y) => order[x.kind] - order[y.kind] || Math.abs(y.after - y.before) - Math.abs(x.after - x.before));

  const session = { id: crypto.randomUUID().slice(0, 8), at: new Date().toISOString(), userId: userId ?? "anon", kind: "committee", client, durationMs: Date.now() - t0,
    items: items.map(({ evidence, ...rest }) => rest), changes, adjustments, badYearLoss: { before: before.badYearLoss, after: after.badYearLoss } };
  const d = db();
  d.sessions = [session, ...(d.sessions ?? [])].slice(0, 30);
  save();
  return { portfolio: after, changes, items, sessionId: session.id, adjustments, outs, durationMs: session.durationMs };
}
