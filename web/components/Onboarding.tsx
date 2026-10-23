"use client";
import { useEffect, useState } from "react";
import { DEMO_TEXT, EXCLUDE_GROUPS, savingsOf, THEMES, type FormInput } from "@/lib/types";
import { api, Info, money, Screen, Title } from "./ui";

export function AuthScreen({ onDone }: { onDone: (u: { id: string; email: string }) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      const r = await api("/api/auth", { action: mode, email, password });
      onDone(r.user);
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <Screen k="auth">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="label mb-3">Bettervest</p>
          <h1 className="font-serif text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">Your rules.<br />Your portfolio.<br /><span className="text-accent">Every reason shown.</span></h1>
          <p className="mt-5 max-w-lg text-lg text-muted">Tell us what you want and what you won&apos;t accept. We build a portfolio around the budget you type in, and show the pros, cons and the rule behind every decision.</p>
        </div>
        <form onSubmit={submit} className="paper p-6 shadow-paper">
          <h2 className="font-serif text-2xl font-semibold">{mode === "login" ? "Log in" : "Create your account"}</h2>
          <label className="mt-4 block text-sm font-semibold" htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-paper p-2.5" required />
          <label className="mt-3 block text-sm font-semibold" htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-paper p-2.5" required />
          {err && <p className="mt-3 text-sm text-bad">{err}</p>}
          <button className="btn mt-5 w-full">{mode === "login" ? "Log in" : "Create account"}</button>
          <button type="button" className="mt-3 w-full text-sm font-semibold text-accent" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
          </button>
        </form>
      </div>
    </Screen>
  );
}

const ONBOARD_STEPS = ["About you", "Preferences", "Your rules"] as const;

export function OnboardingProgress({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="mb-6 grid max-w-3xl grid-cols-3 gap-2" aria-label="Setup progress">
      {ONBOARD_STEPS.map((label, i) => {
        const state = i === current ? "now" : i < current ? "done" : "next";
        return (
          <li key={label} className={`rounded-xl border px-3 py-3 ${state === "now" ? "border-accent bg-baby shadow-paper ring-2 ring-accent" : state === "done" ? "border-line bg-card" : "border-dashed border-line bg-card/70"}`}>
            <span className={`label ${state === "now" ? "!text-accent" : ""}`}>{state === "now" ? "Now" : state === "done" ? "Done" : "Next"}</span>
            <span className={`mt-1 block font-serif text-lg font-semibold ${state === "now" ? "text-accent" : "text-ink"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ResumeScreen({ savedAt, onContinue, onNew }: { savedAt: string; onContinue: () => void; onNew: () => void }) {
  const date = new Date(savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  return (
    <Screen k="resume">
      <Title sub={`You saved your preferences on ${date}. Your dashboard stays separate from setup.`}>Welcome back</Title>
      <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <button className="paper p-5 text-left shadow-paper transition hover:-translate-y-0.5" onClick={onContinue}>
          <strong className="font-serif text-xl">Continue with my preferences</strong>
          <span className="mt-1 block text-muted">Open your dashboard.</span>
        </button>
        <button className="paper p-5 text-left transition hover:-translate-y-0.5" onClick={onNew}>
          <strong className="font-serif text-xl">Start new</strong>
          <span className="mt-1 block text-muted">Set different goals and limits.</span>
        </button>
      </div>
    </Screen>
  );
}

export function AboutScreen({ form, setForm, onNext }: { form: FormInput; setForm: (f: FormInput) => void; onNext: () => void }) {
  const purposes = ["Grow it", "Income later", "Income now", "A one off goal"];
  const [budget, setBudget] = useState(String(savingsOf(form)));
  const set = (patch: Partial<FormInput>) => {
    const next = { ...form, ...patch };
    if ("age" in patch || "retireAge" in patch) next.horizon = Math.max(1, next.retireAge - next.age);
    setForm(next);
  };
  const commitBudget = () => {
    const n = Math.round(Number(budget));
    const next = Number.isFinite(n) && n >= 100 ? n : savingsOf(form);
    setBudget(String(next));
    if (next !== form.savings) set({ savings: next });
  };
  return (
    <Screen k="about">
      <OnboardingProgress current={0} />
      <Title sub="How much you are investing and for how long. Everything else is built around these two numbers.">About you</Title>
      <div className="paper grid max-w-3xl gap-5 p-6 sm:grid-cols-2">
        <label className="text-sm font-semibold">Amount you plan to invest
          <span className="mt-1 flex items-center rounded-lg border border-line bg-paper">
            <span className="pl-3 text-muted">$</span>
            <input aria-label="Amount you plan to invest, in dollars" inputMode="numeric" className="num w-full bg-transparent p-2.5" value={budget}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, "");
                setBudget(raw);
                const n = Math.round(Number(raw));
                if (n >= 100) set({ savings: n });
              }}
              onBlur={commitBudget} />
          </span>
          <span className="mt-1 block font-normal text-muted">Holdings, bad year loss and the analysts all use this amount.</span>
        </label>
        <label className="text-sm font-semibold">Years invested<Info term="Horizon" /><input type="number" min={1} className="mt-1 w-full rounded-lg border border-line bg-paper p-2.5 num" value={form.horizon} onChange={(e) => set({ horizon: Math.max(1, +e.target.value) })} />
          <span className="mt-1 block font-normal text-muted">How long until you need the money.</span>
        </label>
        <div className="sm:col-span-2">
          <p className="text-sm font-semibold">What is the money for?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {purposes.map((p) => <button key={p} type="button" className={`chip ${form.purpose === p ? "chip-on" : ""}`} onClick={() => set({ purpose: p })}>{p}</button>)}
          </div>
        </div>
      </div>
      <button className="btn mt-6" onClick={() => { commitBudget(); onNext(); }}>Continue</button>
    </Screen>
  );
}

const RISK = ["", "Very careful", "Very careful", "Careful", "Careful", "Balanced", "Balanced", "Adventurous", "Adventurous", "Very adventurous", "Very adventurous"];

export function PrefsScreen({ form, setForm, onBack, onNext, onAsk, setup = true }: { form: FormInput; setForm: (f: FormInput) => void; onBack: () => void; onNext: () => void; onAsk: (q: string) => void; setup?: boolean }) {
  const [preview, setPreview] = useState<{ badYearLoss: number; typicalRange: [number, number]; split: { stocks: number; bonds: number } } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => api("/api/data/risk-preview", { horizon: form.horizon, risk: form.risk, amount: savingsOf(form) }).then(setPreview).catch(() => setPreview(null)), 250);
    return () => clearTimeout(t);
  }, [form.horizon, form.risk, form.savings]);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <Screen k="prefs">
      {setup && <OnboardingProgress current={1} />}
      <Title sub="Set the basics, then add anything else in your own words.">Preferences</Title>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="paper p-5">
          <div className="flex items-baseline justify-between"><p className="font-semibold">How much ups and downs can you take?</p><span className="num text-accent">{form.risk}/10 · {RISK[form.risk]}</span></div>
          <input aria-label="Risk appetite" type="range" min={1} max={10} value={form.risk} onChange={(e) => setForm({ ...form, risk: +e.target.value })} className="mt-3 w-full accent-accent" />
          {preview && (
            <div className="mt-3 rounded-lg bg-sky p-3 text-sm">
              <div className="mb-2 flex h-2 overflow-hidden rounded-full"><i className="block bg-accent transition-all" style={{ width: `${preview.split.stocks}%` }} /><i className="block flex-1 bg-baby" /></div>
              <p className="text-muted">{preview.split.stocks}% shares, {preview.split.bonds}% bonds.</p>
              <p className="mt-1">On a budget of <strong className="num">{money(savingsOf(form))}</strong>, a bad year, roughly 1 in 20, could fall by about <strong className="num">{money(preview.badYearLoss)}</strong><Info term="Bad year loss" onAsk={onAsk} />. In a typical year it could move between <span className="num">{money(preview.typicalRange[0])}</span> and <span className="num">plus {money(preview.typicalRange[1])}</span>.</p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="mr-1 font-semibold">Max per holding<Info term="Max per holding" onAsk={onAsk} /></span>
            {([5, 10, 15, 20, "AI"] as const).map((v) => (
              <button key={v} type="button" className={`chip ${form.maxHolding === v ? "chip-on" : ""}`} onClick={() => setForm({ ...form, maxHolding: v })}>{v === "AI" ? "Let AI decide" : `${v}%`}</button>
            ))}
          </div>
        </div>
        <div className="paper p-5">
          <p className="font-semibold">Areas to favour</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {THEMES.map((t) => <button key={t} type="button" className={`chip ${form.favour.includes(t) ? "chip-on" : ""}`} onClick={() => setForm({ ...form, favour: toggle(form.favour, t) })}>{t}</button>)}
          </div>
        </div>
        <div className="paper p-5 lg:col-span-2">
          <p className="font-semibold">Leave out <span className="font-normal text-muted">(these become hard rules)</span><Info term="Hard rule" onAsk={onAsk} /></p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Object.entries(EXCLUDE_GROUPS).map(([g, tags]) => (
              <div key={g}>
                <p className="label mb-2">{g}</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => <button key={t} type="button" className={`chip ${form.exclude.includes(t) ? "border-bad bg-badsoft text-bad" : ""}`} onClick={() => setForm({ ...form, exclude: toggle(form.exclude, t) })}>{t}</button>)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="paper p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="free" className="font-semibold">Anything else, in your own words</label>
            <button type="button" className="text-sm font-semibold text-accent" onClick={() => setForm({ ...form, freeText: DEMO_TEXT })}>Use an example</button>
          </div>
          <textarea id="free" rows={3} value={form.freeText} onChange={(e) => setForm({ ...form, freeText: e.target.value })}
            placeholder="For example: I can't stomach big losses. No tobacco. I like companies that pay dividends."
            className="mt-2 w-full rounded-lg border border-line bg-paper p-3" />
        </div>
      </div>
      <div className="mt-6 flex gap-3"><button className="btn-ghost" onClick={onBack}>Back</button><button className="btn" onClick={onNext}>Continue</button></div>
    </Screen>
  );
}

export function LoadingScreen({ title, lines, step }: { title: string; lines: string[]; step?: 0 | 1 | 2 }) {
  return (
    <Screen k={`loading-${title}`}>
      {step !== undefined && <OnboardingProgress current={step} />}
      <div className="grid min-h-[40vh] place-items-center text-center">
        <div>
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-baby border-t-accent" />
          <h2 className="mt-5 font-serif text-3xl font-semibold">{title}</h2>
          <ul className="mx-auto mt-4 grid max-w-sm gap-1 text-left font-mono text-sm text-muted">
            {lines.map((l) => <li key={l} className="animate-[fadein_.3s_ease]"><span className="text-good">✓</span> {l}</li>)}
          </ul>
        </div>
      </div>
    </Screen>
  );
}
