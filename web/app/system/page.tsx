"use client";
// Behind the scenes page for judges and the team: guardrail counts, learning and accuracy. Not shown to clients.
import { useEffect, useState } from "react";
import { api } from "@/components/ui";

export default function SystemPage() {
  const [d, setD] = useState<any>(null);
  const [llm, setLlm] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api("/api/learning").then(setD).catch(() => null);
    api("/api/llm-health").then(setLlm).catch((e) => setLlm({ ok: false, reason: e.message }));
    api("/api/data/health").then(setData).catch(() => null);
  }, []);
  const s = d?.stats;
  const tiles: [string, string | number | null | undefined, string][] = s ? [
    ["AI numbers checked against the data", s.numbersChecked, "Every number an analyst writes is matched to the evidence pack, within 1%."],
    ["Unsupported numbers blocked", s.unsupportedBlocked, "Numbers that did not match. The analyst had to retry, or the data only summary was shown instead."],
    ["Analyst reviews run", s.analystRuns, `${s.firstTryPass} passed first time, ${s.retried} needed a retry, ${s.fallbacks} used the data only summary.`],
    ["Rules users corrected", d.correctionRate === null ? "none yet" : `${d.correctionRate}%`, "Share of rules read from people's own words that they then changed. Lower means better understanding."],
    ["Corrections remembered", d.correctionsStored, "Phrases corrected by users, reused as examples or applied directly once confirmed twice."],
    ["Rule accuracy before and after learning", d.evals?.ruleAccuracy ? `${d.evals.ruleAccuracy.before}% to ${d.evals.ruleAccuracy.after}%` : "run npm run eval", d.evals ? `${d.evals.expectedRules} expected rules across 12 test sentences (${d.evals.method}).` : ""],
  ] : [];
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="label">Mandate · behind the scenes</p>
      <h1 className="mt-1 font-serif text-4xl font-semibold">System checks</h1>
      <p className="mt-2 max-w-2xl text-muted">How the AI is kept honest. This page is for the team and the judges, not for clients.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="paper p-4"><p className="label">AI model</p><p className="mt-1 font-semibold">{llm ? (llm.ok ? `${llm.model} via ${llm.provider} · ${llm.ms} ms` : "Not connected") : "Checking…"}</p>{llm && !llm.ok && <p className="text-sm text-muted">{llm.reason}</p>}</div>
        <div className="paper p-4"><p className="label">Data sources</p><p className="mt-1 font-semibold">{data ? Object.entries(data.sources).map(([k, v]) => `${k} ${v ? "on" : "off"}`).join(" · ") : "Checking…"}</p></div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(([label, value, note]) => (
          <div key={label} className="paper p-4"><b className="num block text-3xl font-medium">{value ?? 0}</b><p className="font-semibold">{label}</p><p className="mt-1 text-sm text-muted">{note}</p></div>
        ))}
      </div>
    </main>
  );
}
