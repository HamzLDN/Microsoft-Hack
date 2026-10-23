"use client";
import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { HelpChat } from "@/components/HelpChat";
import { AboutScreen, AuthScreen, LoadingScreen, PrefsScreen, ResumeScreen } from "@/components/Onboarding";
import { ChallengeScreen, ConsideredScreen, PortfolioScreen, UnderstoodScreen } from "@/components/Results";
import { StockDrawer } from "@/components/StockDrawer";
import { api, money, Toast } from "@/components/ui";
import { METRIC_TERMS } from "@/lib/ai/glossary";
import { DEFAULT_FORM, type AppRule, type Candidate, type FormInput, type Portfolio } from "@/lib/types";

type Step = "boot" | "auth" | "resume" | "about" | "prefs" | "loading" | "understood" | "building" | "portfolio" | "considered" | "challenge";
const STEPS: [string, Step[]][] = [["About you", ["about"]], ["Preferences", ["prefs", "loading"]], ["Understood", ["understood"]], ["Portfolio", ["building", "portfolio"]], ["Considered", ["considered"]], ["Challenge", ["challenge"]]];
const ALL_METRICS = Object.keys(METRIC_TERMS);
const DEFAULT_METRICS = ["price", "ret1y", "vol", "dd", "pe", "divYield", "revGrowth", "fcfMargin", "beta"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
  const [step, setStep] = useState<Step>("boot");
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [saved, setSaved] = useState<{ savedAt: string; data: { form: FormInput; metrics?: string[] } } | null>(null);
  const [form, setForm] = useState<FormInput>(DEFAULT_FORM);
  const [rules, setRules] = useState<AppRule[]>([]);
  const [p, setP] = useState<Portfolio | null>(null);
  const [overrides, setOverrides] = useState<Record<string, "in" | "out">>({});
  const [weights, setWeights] = useState<Record<string, number> | undefined>();
  const [drawer, setDrawer] = useState<string | null>(null);
  const [help, setHelp] = useState({ open: false, prefill: "" });
  const [lines, setLines] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [trust, setTrust] = useState<any>(null);
  const [learnedNote, setLearnedNote] = useState("");
  const [shown, setShown] = useState<string[]>(DEFAULT_METRICS);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState("");

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), 3800); };
  const ask = (q: string) => setHelp({ open: true, prefill: `${q} ` + "​".repeat(Math.random() * 5) });
  const client = `Age ${form.age}, retiring at ${form.retireAge}, investing $100,000 for ${form.horizon} years. Goal: ${form.purpose}. Rules: ${rules.map((r) => `${r.id} ${r.text} (${r.kind === "hard" ? "hard rule" : "preference"})`).join("; ")}`;

  useEffect(() => {
    try { const m = JSON.parse(localStorage.getItem("mandate-metrics") || "null"); if (Array.isArray(m)) setShown(m); } catch {}
    api("/api/auth").then(async ({ user }) => {
      if (!user) return setStep("auth");
      setUser(user);
      const { latest } = await api("/api/preferences").catch(() => ({ latest: null }));
      setSaved(latest);
      setStep(latest ? "resume" : "about");
    }).catch(() => setStep("auth"));
  }, []);

  const animateLines = async (list: string[], work: Promise<unknown>) => {
    setLines([]);
    for (const l of list) { await sleep(320); setLines((x) => [...x, l]); }
    await work;
  };

  const parse = async (f = form) => {
    setError(""); setStep("loading");
    const words = f.freeText.trim() ? f.freeText.trim().split(/\s+/).length : 0;
    const work = api("/api/parse", { form: f });
    await animateLines(["Read your form", `Read ${words} words of your own text`, "Matched your words to rules", "Checked earlier corrections", "Marked hard rules and preferences"], work);
    const r = await work.catch((e) => { setError(e.message); return null; });
    if (!r) return setStep("prefs");
    setRules(r.rules);
    api("/api/preferences", { form: f, metrics: shown }, "PUT").catch(() => null);
    setStep("understood");
  };

  const build = useCallback(async (ov = overrides, w = weights) => {
    const res = await api<Portfolio & { error?: string }>("/api/portfolio", { rules, horizon: form.horizon, risk: form.risk, maxHolding: form.maxHolding, overrides: ov, weights: w });
    setP(res);
    api("/api/learning").then(setTrust).catch(() => null);
    return res;
  }, [rules, form, overrides, weights]);

  const buildFirst = async () => {
    setError(""); setStep("building"); setOverrides({});
    const work = build({}, weights);
    await animateLines([`Screening 84 companies and funds against ${rules.filter((r) => r.kind === "hard").length} hard rules`, "Scoring growth, profit, stability, income, value and news", `Fitting the mix to a ${form.horizon} year horizon`, "Checking the bad year loss limit", "Writing pros and cons for every company"], work);
    const r = await work.catch((e) => { setError(e.message); return null; });
    setStep(r ? "portfolio" : "understood");
  };

  const onSwipe = async (c: Candidate, own: boolean) => {
    const before = p!;
    const ov = { ...overrides, [c.ticker]: own ? ("in" as const) : ("out" as const) };
    setOverrides(ov);
    const fb = await api("/api/feedback", { kind: "swipe", before: c.status, after: { own, ticker: c.ticker }, context: { parts: c.score.parts.map((x) => ({ name: x.name, value: x.value })) } }).catch(() => null);
    if (fb?.learned?.notes?.[0]) setLearnedNote(`Learned: ${fb.learned.notes[0]}`);
    const after = await build(ov).catch(() => null);
    if (!after) return;
    const lossRule = rules.find((r) => r.field === "max_bad_year_loss");
    flash(`${own ? "Added" : "Dropped"} **${c.name}**. Bad year loss ${money(before.badYearLoss)} to ${money(after.badYearLoss)}, shares ${before.split.stocks}% to ${after.split.stocks}%${lossRule && after.split.stocks < before.split.stocks ? `, to stay within ${lossRule.id}` : ""}.`);
  };

  const reweight = async (w: Record<string, number>) => {
    setWeights(w);
    const defaults = Object.fromEntries((p?.holdings[0]?.score.parts ?? []).map((x) => [x.name, x.weight]));
    api("/api/feedback", { kind: "weight_change", before: defaults, after: { weights: w, adjust: Object.fromEntries(Object.keys(w).map((k) => [k, w[k] - (defaults[k] ?? 0)])) } }).catch(() => null);
    setDrawer(null);
    await build(overrides, w);
    flash("Rebuilt with your scoring weights.");
  };

  const logout = async () => { await api("/api/auth", { action: "logout" }); setUser(null); setStep("auth"); };
  const toggleMetric = (k: string) => {
    const next = shown.includes(k) ? shown.filter((x) => x !== k) : [...shown, k];
    setShown(next);
    try { localStorage.setItem("mandate-metrics", JSON.stringify(next)); } catch {}
  };
  const activeIdx = STEPS.findIndex(([, s]) => s.includes(step));

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <span className="font-serif text-2xl font-semibold">Mandate<span className="text-accent">.</span></span>
          {user && activeIdx >= 0 && (
            <nav className="hidden flex-1 justify-center gap-1 md:flex">
              {STEPS.map(([label], i) => <span key={label} className={`rounded-full px-3 py-1 text-xs ${i === activeIdx ? "bg-baby font-semibold text-accent" : "text-muted"}`}>{label}</span>)}
            </nav>
          )}
          {user && (
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setSettings(!settings)}>Metrics</button>
                {settings && (
                  <div className="paper absolute right-0 top-11 z-30 w-60 p-4 shadow-paper">
                    <p className="label mb-2">Show these figures</p>
                    {ALL_METRICS.map((k) => <label key={k} className="flex items-center gap-2 py-0.5 text-sm"><input type="checkbox" checked={shown.includes(k)} onChange={() => toggleMetric(k)} className="accent-accent" />{METRIC_TERMS[k]}</label>)}
                  </div>
                )}
              </div>
              <button className="text-sm text-muted hover:text-ink" onClick={logout}>Log out</button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {error && <p className="mb-4 rounded-lg bg-badsoft p-3 text-sm text-bad">{error}</p>}
        <AnimatePresence mode="wait">
          {step === "auth" && <AuthScreen key="a" onDone={async (u) => { setUser(u); const { latest } = await api("/api/preferences").catch(() => ({ latest: null })); setSaved(latest); setStep(latest ? "resume" : "about"); }} />}
          {step === "resume" && saved && <ResumeScreen key="r" savedAt={saved.savedAt} onContinue={() => { setForm(saved.data.form); if (saved.data.metrics) setShown(saved.data.metrics); parse(saved.data.form); }} onNew={() => { setForm(DEFAULT_FORM); setStep("about"); }} />}
          {step === "about" && <AboutScreen key="ab" form={form} setForm={setForm} onNext={() => setStep("prefs")} />}
          {step === "prefs" && <PrefsScreen key="pr" form={form} setForm={setForm} onBack={() => setStep("about")} onNext={() => parse()} onAsk={ask} />}
          {step === "loading" && <LoadingScreen key="l" title="Reading your preferences" lines={lines} />}
          {step === "understood" && <UnderstoodScreen key="u" rules={rules} setRules={setRules} onBack={() => setStep("prefs")} onNext={buildFirst} onAsk={ask} />}
          {step === "building" && <LoadingScreen key="b" title="Building your portfolio" lines={lines} />}
          {step === "portfolio" && p && <PortfolioScreen key="p" p={p} rules={rules} trust={trust} onOpen={setDrawer} onConsidered={() => setStep("considered")} onChallenge={() => setStep("challenge")} onEdit={() => setStep("prefs")} onAsk={ask}
            onResetLearning={async () => { await api("/api/learning", undefined, "DELETE"); setWeights(undefined); await build(overrides, undefined); }} />}
          {step === "considered" && p && <ConsideredScreen key="c" p={p} rules={rules} onOpen={setDrawer} onBack={() => setStep("portfolio")} onChallenge={() => setStep("challenge")} />}
          {step === "challenge" && p && <ChallengeScreen key="ch" p={p} onDecide={onSwipe} onOpen={setDrawer} onDone={() => setStep("portfolio")} learnedNote={learnedNote} />}
        </AnimatePresence>
        {step !== "auth" && step !== "boot" && <p className="mt-12 text-center text-xs text-muted">Educational hackathon project. Not financial advice.</p>}
      </div>

      <StockDrawer ticker={drawer} p={p} rules={rules} client={client} shown={shown} onClose={() => setDrawer(null)} onAsk={ask} onReweight={reweight} />
      {user && <HelpChat open={help.open} setOpen={(o) => setHelp({ ...help, open: o })} prefill={help.prefill} context={`Screen: ${step}. ${drawer ? `Looking at ${drawer}.` : ""} ${p ? `Portfolio bad year loss ${p.badYearLoss}, split ${JSON.stringify(p.split)}.` : ""}`} />}
      <Toast text={toast} />
    </main>
  );
}
