"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { DietTab } from "./components/tabs/DietTab";
import { OverviewTab } from "./components/tabs/OverviewTab";
import { ProgressTab } from "./components/tabs/ProgressTab";
import { TrackingTab } from "./components/tabs/TrackingTab";
import { TrainingTab } from "./components/tabs/TrainingTab";
import { WhoopTab } from "./components/tabs/WhoopTab";
import { ReportsTab } from "./components/tabs/ReportsTab";
import { TabBar, type TabId } from "./components/ui/TabBar";
import { BottomNav } from "./components/ui/BottomNav";
import { migrateLocalStorageToTurso } from "@/lib/migrate";
import { programWeekNumber } from "@/lib/dates";
import { USER, PROGRAM_WEEKS } from "@/lib/constants";

export default function HomePage() {
  const [tab, setTab] = useState<TabId>("overview");
  const week = programWeekNumber(USER.startDate);
  const [sessionRefreshKey, setSessionRefreshKey] = useState(0);
  const handleSessionMutated = useCallback(() => setSessionRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("migrate") === "1") localStorage.removeItem("shred_migrated_to_turso_v1");
    migrateLocalStorageToTurso().catch(() => {});
  }, []);

  const TAB_LABELS: Record<TabId, string> = {
    overview: "Aperçu",
    diet: "Régime",
    training: "Entraînement",
    tracking: "Quotidien",
    whoop: "WHOOP",
    progress: "Progression",
    reports: "Rapports",
  };

  return (
    <div className="min-h-screen bg-shred-bg">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-shred-border bg-shred-bg/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-3 sm:px-4">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-3">
              <span className="font-display text-base sm:text-lg tracking-[0.22em] text-shred-accent leading-none">
                SHRED
              </span>
              {/* current tab — mobile */}
              <span className="lg:hidden font-mono text-xs text-shred-muted uppercase tracking-widest">
                / {TAB_LABELS[tab]}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-mono text-[10px] text-shred-muted capitalize leading-none">
                  {format(new Date(), "EEE d MMM", { locale: fr })}
                </p>
                <p className="font-mono text-[10px] text-shred-muted/50 mt-0.5 leading-none">
                  S<span className="text-shred-accent3">{week}</span>/{PROGRAM_WEEKS}
                </p>
              </div>
            </div>
          </div>

          {/* Desktop tab bar — hidden on mobile */}
          <div className="hidden lg:block">
            <TabBar active={tab} onChange={setTab} />
          </div>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-5 pb-28 lg:pb-8">
        <div key={tab} className="animate-fade-in">
          {tab === "overview"  && <OverviewTab sessionRefreshKey={sessionRefreshKey} />}
          {tab === "diet"      && <DietTab />}
          {tab === "training"  && <TrainingTab onSessionMutated={handleSessionMutated} />}
          {tab === "tracking"  && <TrackingTab />}
          {tab === "whoop"     && <WhoopTab />}
          {tab === "progress"  && <ProgressTab />}
          {tab === "reports"   && <ReportsTab />}
        </div>
      </main>

      {/* ── Mobile bottom nav ──────────────────────────────────────────── */}
      <div className="lg:hidden">
        <BottomNav active={tab} onChange={setTab} />
      </div>
    </div>
  );
}
