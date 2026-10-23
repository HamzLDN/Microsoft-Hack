"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ReactNode, useState } from "react";
import { GLOSSARY } from "@/lib/ai/glossary";

/** Renders **bold** markers from analyst text. */
export function Bold({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className={className}>
      {parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
    </span>
  );
}

export const money = (n: number) => `${n < 0 ? "minus " : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

/** Info icon with the plain English meaning and an "Ask about this" link into the help assistant. */
export function Info({ term, onAsk }: { term: string; onAsk?: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  const text = GLOSSARY[term];
  if (!text) return null;
  return (
    <span className="relative inline-block align-middle">
      <button type="button" aria-label={`What is ${term}?`} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-accent/40 text-[10px] font-bold text-accent hover:bg-baby">i</button>
      <AnimatePresence>
        {open && (
          <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute left-1/2 top-6 z-40 block w-64 -translate-x-1/2 rounded-lg border border-line bg-card p-3 text-left text-sm font-normal normal-case tracking-normal text-ink shadow-paper"
            onClick={(e) => e.stopPropagation()}>
            <strong className="block font-serif text-base">{term}</strong>
            <span className="mt-1 block text-muted">{text}</span>
            {onAsk && (
              <button type="button" className="mt-2 text-sm font-semibold text-accent" onClick={() => { setOpen(false); onAsk(`What does ${term} mean for me here?`); }}>
                Ask about this
              </button>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export function Screen({ children, k }: { children: ReactNode; k: string }) {
  return (
    <motion.section key={k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}>
      {children}
    </motion.section>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{children}</h1>
      {sub && <p className="mt-2 max-w-2xl text-lg text-muted">{sub}</p>}
    </header>
  );
}

export function Pill({ tone, children }: { tone: "good" | "bad" | "warn" | "blue"; children: ReactNode }) {
  const cls = { good: "bg-goodsoft text-good", bad: "bg-badsoft text-bad", warn: "bg-warnsoft text-warn", blue: "bg-baby text-accent" }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function Toast({ text }: { text: string | null }) {
  return (
    <AnimatePresence>
      {text && (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
          className="fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-paper">
          <Bold text={text} className="[&_strong]:text-white" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export async function api<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(path, { method: method ?? (body ? "POST" : "GET"), headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}
