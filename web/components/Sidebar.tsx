"use client";
import { ReactNode, useEffect, useState } from "react";

export function Sidebar({
  open,
  onToggle,
  assistant,
  extra,
  focusAssistant = 0,
}: {
  open: boolean;
  onToggle: () => void;
  assistant: ReactNode;
  extra?: ReactNode;
  focusAssistant?: number;
}) {
  const [tab, setTab] = useState<"assistant" | "extra">("assistant");
  useEffect(() => { if (!extra && tab === "extra") setTab("assistant"); }, [extra, tab]);
  useEffect(() => { if (focusAssistant) setTab("assistant"); }, [focusAssistant]);
  const showExtra = tab === "extra" && Boolean(extra);

  return (
    <>
      {open && <button type="button" className="fixed inset-0 z-30 bg-ink/30 md:hidden" aria-label="Close sidebar" onClick={onToggle} />}
      <aside
        aria-label="Sidebar"
        className={`fixed bottom-0 right-0 top-0 z-40 flex flex-col border-line bg-paper md:sticky md:top-0 md:z-10 md:h-screen ${open ? "w-[min(100vw,22rem)] border-l" : "pointer-events-none w-0 overflow-hidden md:pointer-events-auto md:w-12 md:overflow-visible md:border-l"}`}
      >
        <div className={open ? "flex h-full min-h-0 flex-col" : "hidden"}>
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <button type="button" className={`chip px-2.5 py-1 text-xs ${tab === "assistant" ? "chip-on" : ""}`} onClick={() => setTab("assistant")}>Assistant</button>
            {extra && <button type="button" className={`chip px-2.5 py-1 text-xs ${tab === "extra" ? "chip-on" : ""}`} onClick={() => setTab("extra")}>Briefing</button>}
            <button type="button" className="btn-ghost ml-auto px-2.5 py-1 text-xs" onClick={onToggle} aria-expanded={open} aria-label="Collapse sidebar">Hide</button>
          </div>
          <div className={showExtra ? "hidden" : "flex min-h-0 flex-1 flex-col"}>{assistant}</div>
          {extra && <div className={showExtra ? "min-h-0 flex-1 overflow-y-auto p-3" : "hidden"}>{extra}</div>}
        </div>
        {!open && (
          <button type="button" className="hidden h-full w-12 flex-col items-center gap-3 py-4 text-xs font-semibold text-accent md:flex" onClick={onToggle} aria-expanded={false} aria-label="Expand sidebar">
            <span aria-hidden className="text-base leading-none">‹</span>
            <span className="tracking-wide [writing-mode:vertical-rl]">Assistant</span>
          </button>
        )}
      </aside>
    </>
  );
}
