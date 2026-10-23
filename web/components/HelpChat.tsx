"use client";
import { useEffect, useRef, useState } from "react";
import { api, Bold } from "./ui";

type Msg = { role: "user" | "assistant"; content: string };

export function HelpChat({ prefill, context }: { prefill: string; context: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: "I'm the Bettervest assistant. Ask what anything on screen means, or name a stock or ETF and I'll look up the price." }]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const sent = useRef("");
  const scroller = useRef<HTMLDivElement>(null);

  const send = async (raw: string) => {
    const text = raw.replace(/\u200b/g, "").trim();
    if (!text || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next); setQ(""); setBusy(true);
    const r = await api("/api/chat", { mode: "help", context, messages: next.filter((m, i) => i > 0) }).catch(() => ({ reply: "I couldn't answer that just now." }));
    setMsgs([...next, { role: "assistant", content: r.reply || "I couldn't answer that just now." }]);
    setBusy(false);
  };

  useEffect(() => {
    const text = prefill.replace(/\u200b/g, "").trim();
    if (!text || sent.current === prefill) return;
    sent.current = prefill;
    send(prefill);
    // send closes over the latest messages; prefill is the trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [msgs, busy]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto p-4 text-sm">
        {msgs.map((m, i) => <p key={i} className={`whitespace-pre-line rounded-lg p-2.5 ${m.role === "user" ? "ml-6 bg-sky" : "mr-4 bg-baby"}`}><Bold text={m.content} /></p>)}
        {busy && <p className="animate-pulse text-muted">Thinking…</p>}
      </div>
      <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); send(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about a term or a price" className="min-w-0 flex-1 rounded-lg border border-line bg-card p-2 text-sm" />
        <button className="btn px-3 py-2" type="submit" disabled={busy}>Send</button>
      </form>
    </div>
  );
}
