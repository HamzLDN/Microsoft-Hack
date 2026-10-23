"use client";
import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Dashboard, type BoardView } from "@/components/Dashboard";
import { HelpChat } from "@/components/HelpChat";
import { AboutScreen, AuthScreen, LoadingScreen, PrefsScreen } from "@/components/Onboarding";
import { UnderstoodScreen } from "@/components/Results";
import { StockDrawer } from "@/components/StockDrawer";
import { api, money, Toast } from "@/components/ui";
import { METRIC_TERMS } from "@/lib/ai/glossary";
import { DEFAULT_FORM, savingsOf, type AppRule, type Candidate, type FormInput, type Portfolio } from "@/lib/types";

type Step = "boot" | "auth" | "about" | "prefs" | "reading" | "understood" | "opening" | "portfolio";
type SavedPrefs = { savedAt: string; data: { form: FormInput; metrics?: string[]; rules?: AppRule[]; onboarded?: boolean } };
const ONBOARD: { label: string; steps: Step[]; index: 0 | 1 | 2 }[] = [
  { label: "About you", steps: ["about"], index: 0 },
  { label: "Preferences", steps: ["prefs"], index: 1 },
  { label: "Your rules", steps: ["reading", "understood"], index: 2 },
];
const ALL_METRICS = Object.keys(METRIC_TERMS);
const DEFAULT_METRICS = ["price", "ret1y", "vol", "dd", "pe", "divYield", "revGrowth", "fcfMargin", "beta"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
  const [step, setStep] = useState<Step>("boot");
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [onboarded, setOnboarded] = useState(false);
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
  const [largeText, setLargeText] = useState(false);
  useEffect(() => {
    try { const on = localStorage.getItem("bettervest-large-text") === "1"; setLargeText(on); document.documentElement.classList.toggle("large-text", on); } catch {}
  }, []);
  const toggleLargeText = () => {
    const on = !largeText;
    setLargeText(on);
    document.documentElement.classList.toggle("large-text", on);
    try { localStorage.setItem("bettervest-large-text", on ? "1" : "0"); } catch {}
  };
  const [board, setBoard] = useState<BoardView>("overview");
  const [committee, setCommittee] = useState<{ status: "idle" | "running" | "done" | "failed"; changes?: any[]; items?: any[]; sessionId?: string; adjustments?: Record<string, number>; reviewed?: number }>({ status: "idle" });

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(null), 3800); };
  const ask = (q: string) => setHelp({ open: true, prefill: `${q} ` + "​".repeat(Math.random() * 5) });
  const client = `Investing $${savingsOf(form).toLocaleString("en-US")} for ${form.horizon} years. Goal: ${form.purpose}. Rules: ${rules.map((r) => `${r.id} ${r.text} (${r.kind === "hard" ? "hard rule" : "preference"})`).join("; ")}`;

  useEffect(() => {
    let cancelled = false;
    try { const m = JSON.parse(localStorage.getItem("mandate-metrics") || "null"); if (Array.isArray(m)) setShown(m); } catch {}
    api("/api/auth").then(async ({ user }) => {
      if (cancelled) return;
      if (!user) return setStep("auth");
      setUser(user);
      const { latest } = await api<{ latest: SavedPrefs | null }>("/api/preferences").catch(() => ({ latest: null }));
      if (cancelled) return;
      if (latest?.data?.form) {
        if (latest.data.metrics) setShown(latest.data.metrics);
        setOnboarded(true);
        void openDashboard(latest.data.form, latest.data.rules, true, () => cancelled);
      } else setStep("about");
    }).catch(() => { if (!cancelled) setStep("auth"); });
    return () => { cancelled = true; };
  }, []);

  const animateLines = async (list: string[], work: Promise<unknown>) => {
    setLines([]);
    for (const l of list) { await sleep(320); setLines((x) => [...x, l]); }
    await work;
  };

  const reviewRules = async (f = form) => {
    setError("");
    setForm(f);
    setStep("reading");
    const words = f.freeText.trim() ? f.freeText.trim().split(/\s+/).length : 0;
    const work = api("/api/parse", { form: f });
    await animateLines(["Read your preferences", `Read ${words} words of your own text`, "Matched your words to rules"], work);
    const r = await work.catch((e) => { setError(e.message); return null; });
    if (!r) return setStep("prefs");
    setRules(r.rules as AppRule[]);
    setStep("understood");
  };

  const openDashboard = async (f: FormInput, knownRules?: AppRule[], quiet = false, stopped: () => boolean = () => false) => {
    setError("");
    setForm(f);
    setStep("opening");
    if (knownRules) setLines(["Building from the rules you kept"]);
    let nextRules = knownRules;
    if (knownRules === undefined) {
      const words = f.freeText.trim() ? f.freeText.trim().split(/\s+/).length : 0;
      const work = api("/api/parse", { form: f });
      await animateLines(["Read your preferences", `Read ${words} words of your own text`, "Matched your words to rules"], work);
      if (stopped()) return;
      const r = await work.catch((e) => { setError(e.message); return null; });
      if (stopped()) return;
      if (!r) return setStep("prefs");
      nextRules = r.rules as AppRule[];
    }
    if (stopped() || !nextRules) return;
    setRules(nextRules);
    setOverrides({});
    setCommittee({ status: "idle" });
    const portfolio = await api<Portfolio>("/api/portfolio", { rules: nextRules, horizon: f.horizon, risk: f.risk, maxHolding: f.maxHolding, overrides: {}, weights, amount: savingsOf(f) }).catch((e) => { setError(e.message); return null; });
    if (stopped()) return;
    if (!portfolio) return setStep(knownRules === undefined ? "prefs" : "understood");
    setP(portfolio);
    setOnboarded(true);
    api("/api/preferences", { form: f, metrics: shown, rules: nextRules, onboarded: true }, "PUT").catch(() => null);
    setStep("portfolio");
    void runCommittee(nextRules, f, quiet);
  };

  const build = useCallback(async (ov = overrides, w = weights) => {
    const res = await api<Portfolio & { error?: string }>("/api/portfolio", { rules, horizon: form.horizon, risk: form.risk, maxHolding: form.maxHolding, overrides: ov, weights: w, adjustments: committee.adjustments, amount: savingsOf(form) });
    setP(res);
    api("/api/learning").then(setTrust).catch(() => null);
    return res;
  }, [rules, form, overrides, weights, committee.adjustments]);

  const runCommittee = async (nextRules?: AppRule[], f?: FormInput, quiet = false) => {
    const useRules = nextRules ?? rules;
    const useForm = f ?? form;
    const brief = `Investing $${savingsOf(useForm).toLocaleString("en-US")} for ${useForm.horizon} years. Goal: ${useForm.purpose}. Rules: ${useRules.map((r) => `${r.id} ${r.text} (${r.kind === "hard" ? "hard rule" : "preference"})`).join("; ")}`;
    setCommittee({ status: "running" });
    try {
      const r = await api("/api/committee", { request: { rules: useRules, horizon: useForm.horizon, risk: useForm.risk, maxHolding: useForm.maxHolding, overrides, weights, amount: savingsOf(useForm) }, client: brief });
      setP(r.portfolio);
      setCommittee({ status: "done", changes: r.changes, items: r.items, sessionId: r.sessionId, adjustments: r.adjustments, reviewed: r.items.length });
      if (!quiet) flash(r.changes.length ? `The committee changed **${r.changes.length}** holdings after discussing them.` : "The committee reviewed every holding and kept the portfolio as it was.");
    } catch {
      setCommittee({ status: "failed" });
    }
  };

  const afterAuth = async (u: { id: string; email: string }) => {
    setUser(u);
    const { latest } = await api<{ latest: SavedPrefs | null }>("/api/preferences").catch(() => ({ latest: null }));
    if (latest?.data?.form) {
      if (latest.data.metrics) setShown(latest.data.metrics);
      setOnboarded(true);
      void openDashboard(latest.data.form, latest.data.rules, true);
    } else {
      setOnboarded(false);
      setForm(DEFAULT_FORM);
      setStep("about");
    }
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

  const logout = async () => { await api("/api/auth", { action: "logout" }); setUser(null); setOnboarded(false); setP(null); setStep("auth"); };
  const toggleMetric = (k: string) => {
    const next = shown.includes(k) ? shown.filter((x) => x !== k) : [...shown, k];
    setShown(next);
    try { localStorage.setItem("mandate-metrics", JSON.stringify(next)); } catch {}
  };
  const onboard = ONBOARD.find((s) => s.steps.includes(step));
  const portfolioContext = p
    ? `Bad year loss ${p.badYearLoss}. Typical year ${p.typicalRange[0]} to ${p.typicalRange[1]}. Split ${p.split.stocks}% shares, ${p.split.bonds}% bonds, ${p.split.cash}% cash. Holdings: ${p.holdings.map((h) => `${h.name} (${h.ticker}) $${Math.round(h.amount)}`).join(", ")}. Rules: ${p.ruleSummary.map((s) => `${s.ruleId} ${s.status}`).join("; ")}.`
    : "";
  const chatContext = `Screen: ${step}. ${drawer ? `Looking at ${drawer}.` : ""} ${portfolioContext}`;

  return (
    <div className="flex min-h-screen">
      <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <span className="font-serif text-2xl font-semibold tracking-wide">BETTERVEST</span>
          {user && step === "portfolio" && <span className="hidden rounded-full bg-baby px-3 py-1 text-xs font-semibold text-accent md:inline">Dashboard</span>}
          {user && !onboarded && onboard && (
            <nav className="hidden flex-1 justify-center gap-1 md:flex" aria-label="Setup">
              {ONBOARD.map((s) => (
                <span key={s.label} className={`rounded-full px-3 py-1 text-xs ${s.index === onboard.index ? "bg-baby font-semibold text-accent ring-2 ring-accent" : s.index < onboard.index ? "bg-sky font-semibold text-ink" : "text-muted"}`}>{s.label}</span>
              ))}
            </nav>
          )}
          {user && (
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <button className="btn-ghost px-3 py-1.5 text-sm" onClick={toggleLargeText} aria-pressed={largeText} title="Make all text larger">{largeText ? "A- Normal text" : "A+ Larger text"}</button>
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {error && <p className="mb-4 rounded-lg bg-badsoft p-3 text-sm text-bad">{error}</p>}
        <AnimatePresence mode="wait">
          {step === "auth" && <AuthScreen key="a" onDone={afterAuth} />}
          {step === "about" && <AboutScreen key="ab" form={form} setForm={setForm} onNext={() => setStep("prefs")} />}
          {step === "prefs" && <PrefsScreen key="pr" setup={!onboarded} form={form} setForm={setForm} onBack={() => (onboarded && p ? setStep("portfolio") : setStep("about"))} onNext={() => reviewRules(form)} onAsk={ask} />}
          {step === "reading" && <LoadingScreen key="rd" title="Reading what you asked for" lines={lines} step={2} />}
          {step === "understood" && <UnderstoodScreen key="u" rules={rules} setRules={setRules} onBack={() => setStep("prefs")} onNext={() => openDashboard(form, rules)} onAsk={ask} />}
          {step === "opening" && <LoadingScreen key="o" title="Opening your dashboard" lines={lines} step={2} />}
          {step === "portfolio" && p && <Dashboard key="p" p={p} rules={rules} trust={trust} committee={committee} onRerunCommittee={() => runCommittee()} onResetLearning={async () => { await api("/api/learning", undefined, "DELETE"); setWeights(undefined); await build(overrides, undefined); }} onOpen={setDrawer} onEdit={() => setStep("about")} onAsk={ask} onDecide={onSwipe} learnedNote={learnedNote} view={board} onView={setBoard} />}
        </AnimatePresence>
        {step !== "auth" && step !== "boot" && <p className="mt-12 text-center text-xs text-muted">Educational hackathon project. Not financial advice. · <a href="/backstage" target="_blank" className="underline hover:text-accent">Backstage</a></p>}
      </main>
      </div>

      <StockDrawer ticker={drawer} p={p} rules={rules} client={client} shown={shown} committeeItem={committee.items?.find((x) => x.ticker === drawer)} onClose={() => setDrawer(null)} onAsk={ask} onReweight={reweight} />
      {user && (
        <>
          <button type="button" onClick={() => setHelp((h) => ({ ...h, open: !h.open }))} className="fixed bottom-5 right-5 z-50 rounded-full bg-accent px-5 py-3 font-semibold text-white shadow-paper">{help.open ? "Close help" : "Ask"}</button>
          {help.open && (
            <div className="fixed bottom-20 right-5 z-50 flex h-[min(70vh,560px)] w-[min(380px,90vw)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-paper">
              <p className="border-b border-line p-4 font-serif text-lg font-semibold">Help</p>
              <HelpChat prefill={help.prefill} context={chatContext} />
            </div>
          )}
        </>
      )}
      <Toast text={toast} />
    </div>
  );
}
