"use client";

import { useState } from "react";
import { DietTab } from "./components/tabs/DietTab";
import { OverviewTab } from "./components/tabs/OverviewTab";
import { ProgressTab } from "./components/tabs/ProgressTab";
import { TrackingTab } from "./components/tabs/TrackingTab";
import { TrainingTab } from "./components/tabs/TrainingTab";
import { WhoopTab } from "./components/tabs/WhoopTab";
import { TabBar, type TabId } from "./components/ui/TabBar";

export default function HomePage() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div className="min-h-screen bg-shred-bg">
      <div className="border-b border-shred-border bg-shred-surface2/80">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-2xl tracking-[0.2em] text-shred-accent">SHRED PROTOCOL</p>
            <p className="text-xs font-mono text-shred-muted mt-1">Industrial · Athletic · Data-first</p>
          </div>
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
