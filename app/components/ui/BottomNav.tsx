"use client";

import { useState, type ReactNode } from "react";
import type { TabId } from "./TabBar";

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const PRIMARY_TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  {
    id: "overview",
    label: "Aperçu",
    icon: <Svg><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></Svg>,
  },
  {
    id: "training",
    label: "Entraînement",
    icon: <Svg><path d="M6.5 6.5h11M6.5 17.5h11"/><rect x="3" y="4.5" width="3.5" height="15" rx="1"/><rect x="17.5" y="4.5" width="3.5" height="15" rx="1"/></Svg>,
  },
  {
    id: "diet",
    label: "Régime",
    icon: <Svg><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3z"/><path d="M16 15v7"/></Svg>,
  },
  {
    id: "tracking",
    label: "Quotidien",
    icon: <Svg><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></Svg>,
  },
];

const MORE_TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  {
    id: "progress",
    label: "Progression",
    icon: <Svg><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></Svg>,
  },
  {
    id: "whoop",
    label: "WHOOP",
    icon: <Svg><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></Svg>,
  },
  {
    id: "reports",
    label: "Rapports",
    icon: <Svg><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></Svg>,
  },
];

const SECONDARY_IDS = new Set<TabId>(MORE_TABS.map((t) => t.id));

export function BottomNav({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const isMoreActive = SECONDARY_IDS.has(active);

  function navigate(id: TabId) {
    onChange(id);
    setShowMore(false);
  }

  return (
    <>
      {/* Overlay */}
      {showMore && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* More sheet */}
      {showMore && (
        <div className="fixed bottom-[72px] left-3 right-3 z-40 rounded-2xl border border-shred-border bg-shred-surface2 p-2 animate-slide-up shadow-2xl">
          <div className="w-8 h-1 bg-shred-border rounded-full mx-auto mb-2" />
          {MORE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                active === t.id
                  ? "bg-shred-surface text-shred-accent"
                  : "text-shred-muted hover:text-shred-text hover:bg-shred-surface"
              }`}
            >
              <span>{t.icon}</span>
              <span className="font-mono text-sm">{t.label}</span>
              {active === t.id && (
                <span className="ml-auto text-shred-accent text-xs">●</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-shred-bg/95 backdrop-blur-md border-t border-shred-border safe-bottom">
        <div className="flex items-stretch h-[68px]">
          {PRIMARY_TABS.map((t) => {
            const isOn = active === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => navigate(t.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors ${
                  isOn ? "text-shred-accent" : "text-shred-muted"
                }`}
              >
                <span className={`transition-transform ${isOn ? "scale-110" : ""}`}>{t.icon}</span>
                <span className={`text-[9px] font-mono uppercase tracking-wide leading-none ${isOn ? "text-shred-accent" : "text-shred-muted/70"}`}>
                  {t.label.split(" ")[0]}
                </span>
                {isOn && <span className="absolute bottom-0 w-8 h-0.5 bg-shred-accent rounded-full" />}
              </button>
            );
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => setShowMore((s) => !s)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors relative ${
              isMoreActive || showMore ? "text-shred-accent" : "text-shred-muted"
            }`}
          >
            <Svg>
              <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>
              <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>
            </Svg>
            <span className="text-[9px] font-mono uppercase tracking-wide leading-none opacity-70">Plus</span>
            {isMoreActive && (
              <span className="absolute top-2 right-6 w-1.5 h-1.5 bg-shred-accent rounded-full" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
