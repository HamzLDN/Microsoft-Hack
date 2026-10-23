"use client";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api, Bold } from "./ui";

type Msg = { role: "user" | "assistant"; content: string };

export function HelpChat({ open, setOpen, prefill, context }: { open: boolean; setOpen: (b: boolean) => void; prefill: string; context: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: "Ask me what anything on screen means, like **bad year loss** or **volatility**." }]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (raw: string) => {
    const text = raw.replace(/\u200b/g, "").trim();
    if (!text) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next); setQ(""); setBusy(true);
    const r = await api("/api/chat", { mode: "help", context, messages: next.filter((m, i) => i > 0) }).catch(() => ({ reply: "I couldn't answer that just now." }));
    setMsgs([...next, { role: "assistant", content: r.reply }]); setBusy(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && prefill) send(prefill); }, [prefill]);
  return (
    <>
      <button onClick={() => setOpen(!open)} className="fixed bottom-5 right-5 z-50 rounded-full bg-accent px-5 py-3 font-semibold text-white shadow-paper">{open ? "Close help" : "Ask"}</button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 right-5 z-50 flex max-h-[70vh] w-[min(380px,90vw)] flex-col rounded-2xl border border-line bg-card shadow-paper">
            <p className="border-b border-line p-4 font-serif text-lg font-semibold">Help</p>
            <div className="grid flex-1 content-start gap-2 overflow-y-auto p-4 text-sm">
              {msgs.map((m, i) => <p key={i} className={`whitespace-pre-line rounded-lg p-2.5 ${m.role === "user" ? "ml-8 bg-sky" : "mr-8 bg-baby"}`}><Bold text={m.content} /></p>)}
              {busy && <p className="animate-pulse text-muted">Thinking…</p>}
            </div>
            <div className="flex gap-2 border-t border-line p-3">
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(q)} placeholder="What does this mean?" className="flex-1 rounded-lg border border-line p-2" />
              <button className="btn px-3 py-2" onClick={() => send(q)}>Send</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
