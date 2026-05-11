"use client";

import { useEffect, useState } from "react";
import { DietTab } from "./components/tabs/DietTab";
import { OverviewTab } from "./components/tabs/OverviewTab";
import { ProgressTab } from "./components/tabs/ProgressTab";
import { TrackingTab } from "./components/tabs/TrackingTab";
import { TrainingTab } from "./components/tabs/TrainingTab";
import { WhoopTab } from "./components/tabs/WhoopTab";
import { TabBar, type TabId } from "./components/ui/TabBar";
import { migrateLocalStorageToTurso } from "@/lib/migrate";

export default function HomePage() {
  const [tab, setTab] = useState<TabId>("overview");

  const [migrating, setMigrating] = useState(false);
  const [migrated, setMigrated] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("migrate") === "1") {
      localStorage.removeItem("shred_migrated_to_turso_v1");
    }
    migrateLocalStorageToTurso().catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-shred-bg">
      <div className="border-b border-shred-border bg-shred-surface2/80">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-2xl tracking-[0.2em] text-shred-accent">SHRED PROTOCOL</p>
            <p className="text-xs font-mono text-shred-muted mt-1">Industriel · Athlétique · Données d&apos;abord</p>
          </div>
          <button
            onClick={async () => {
              setMigrating(true);
              localStorage.removeItem("shred_migrated_to_turso_v1");
              await migrateLocalStorageToTurso();
              setMigrating(false);
              setMigrated(true);
              window.location.reload();
            }}
            className="text-xs font-mono px-3 py-1 rounded border border-shred-border bg-shred-surface text-shred-muted hover:text-shred-text"
          >
            {migrating ? "Sync..." : migrated ? "✓ Sync fait" : "Sync données"}
          </button>
        </div>
      </div>
      <TabBar active={tab} onChange={setTab} />
      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-6 pb-24">
        {tab === "overview" ? <OverviewTab /> : null}
        {tab === "diet" ? <DietTab /> : null}
        {tab === "training" ? <TrainingTab /> : null}
        {tab === "tracking" ? <TrackingTab /> : null}
        {tab === "whoop" ? <WhoopTab /> : null}
        {tab === "progress" ? <ProgressTab /> : null}
      </main>
    </div>
  );
}
