// Learning from refinements: swipes shift personal score weights; rule corrections are remembered for everyone.
import type { Learned } from "./server/db";

export const PARTS = ["Growth", "Profitability", "Stability", "Income", "Valuation", "News"] as const;

export function applySwipe(learned: Learned, own: boolean, parts: { name: string; value: number }[]): Learned {
  const adj = { ...learned.weightAdjust };
  let best = { name: "", delta: 0 };
  for (const p of parts) {
    const delta = (own ? 1 : -1) * 4 * ((p.value - 50) / 50);
    const next = Math.max(-10, Math.min(10, (adj[p.name] ?? 0) + delta));
    const applied = next - (adj[p.name] ?? 0);
    adj[p.name] = Math.round(next * 10) / 10;
    if (Math.abs(applied) > Math.abs(best.delta)) best = { name: p.name, delta: applied };
  }
  let notes = [...learned.notes];
  if (best.name && Math.abs(best.delta) >= 0.5) {
    const total = adj[best.name];
    notes = notes.filter((n) => !n.startsWith(`You value ${best.name} `));
    notes.unshift(`You value ${best.name} ${total >= 0 ? "more" : "less"} (${total >= 0 ? "+" : "minus "}${Math.abs(total).toFixed(1)})`);
  }
  return { weightAdjust: adj, notes: Array.from(new Set(notes)).slice(0, 5) };
}

export function personalWeights(defaults: Record<string, number>, learned?: Learned) {
  const out: Record<string, number> = {};
  for (const k of Object.keys(defaults)) out[k] = Math.round(Math.max(0, defaults[k] + (learned?.weightAdjust[k] ?? 0)) * 10) / 10;
  return out;
}

export function correctionRate(parses: { parsed: number; corrected: number }[]) {
  const recent = parses.slice(-50);
  const parsed = recent.reduce((s, p) => s + p.parsed, 0);
  return parsed ? Math.round((recent.reduce((s, p) => s + Math.min(p.corrected, p.parsed), 0) / parsed) * 1000) / 10 : null;
}
