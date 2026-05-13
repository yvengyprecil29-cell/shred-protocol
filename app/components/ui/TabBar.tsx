"use client";

import type { ReactNode } from "react";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  overview:  <Svg><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Svg>,
  diet:      <Svg><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3z"/><path d="M16 15v7"/></Svg>,
  training:  <Svg><path d="M6.5 6.5h11M6.5 17.5h11"/><rect x="3" y="4.5" width="3.5" height="15" rx="1"/><rect x="17.5" y="4.5" width="3.5" height="15" rx="1"/></Svg>,
  tracking:  <Svg><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></Svg>,
  whoop:     <Svg><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></Svg>,
  progress:  <Svg><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></Svg>,
  reports:   <Svg><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></Svg>,
};

const TABS = [
  { id: "overview",  label: "Aperçu" },
  { id: "diet",      label: "Régime" },
  { id: "training",  label: "Entraînement" },
  { id: "tracking",  label: "Quotidien" },
  { id: "whoop",     label: "WHOOP" },
  { id: "progress",  label: "Progression" },
  { id: "reports",   label: "Rapports" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export function TabBar({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  return (
    <div className="flex overflow-x-auto no-scrollbar -mb-px">
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`
              shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-mono uppercase tracking-wide
              border-b-2 transition-all duration-150
              ${on
                ? "border-shred-accent text-shred-accent"
                : "border-transparent text-shred-muted hover:text-shred-text hover:border-shred-border/60"
              }
            `}
          >
            <span className={on ? "text-shred-accent" : "text-shred-muted/70"}>{ICONS[t.id]}</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
