"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MACRO_REST, MACRO_TRAINING, PROGRAM_WEEKS, USER } from "@/lib/constants";
import { programWeekNumber } from "@/lib/dates";
import type { DailyLog } from "@/lib/types";
import { localStore } from "@/lib/localStore";
import { MacroBar } from "../ui/MacroBar";
import { StatCard } from "../ui/StatCard";

export function OverviewTab() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [dayMode, setDayMode] = useState<"training" | "rest">("training");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/logs");
      const j = await res.json();
      if (res.ok && j.ok) {
        setLogs(j.data as DailyLog[]);
        return;
      }
      const local = localStore.getDailyLogs() as DailyLog[];
      setLogs(local);
    })();
  }, []);

  const latest = logs[0];
  const macros = dayMode === "training" ? MACRO_TRAINING : MACRO_REST;

  const week = programWeekNumber(USER.startDate);
  const weekPct = (week / PROGRAM_WEEKS) * 100;

  const projection = useMemo(() => {
    const start = USER.startWeightKg;
    const end = USER.goalWeightKg;
    const n = PROGRAM_WEEKS;
    return Array.from({ length: n }, (_, i) => {
      const wk = i + 1;
      const w = start + ((end - start) * i) / (n - 1);
      return { week: `S${wk}`, kg: Math.round(w * 10) / 10 };
    });
  }, []);

  const rules = [
    {
      title: "Priorité aux protéines",
      body: "Viser 210 g/jour — structure chaque repas autour d'une protéine complète avant les accompagnements.",
      edge: "border-t-shred-accent3",
    },
    {
      title: "Timing des glucides",
      body: "Entraînement : regrouper les glucides avant/après la séance. Repos : max 2 repas, répartir ≤100 g au total.",
      edge: "border-t-shred-accent",
    },
    {
      title: "Sources de lipides",
      body: "Huile d'olive, poisson, œufs, avocat. Aide à stabiliser les hormones pendant la sèche.",
      edge: "border-t-shred-accent2",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl sm:text-5xl tracking-[0.08em] text-shred-text">SHRED PROTOCOL</h1>
        <p className="mt-2 text-shred-muted font-sans max-w-2xl">
          {USER.name} · objectif ~{USER.goalWeightKg} kg fin août · bloc de {PROGRAM_WEEKS} semaines
        </p>
      </header>

      <section>
        <div className="flex items-center justify-between gap-4 mb-2">
          <h2 className="font-display text-xl tracking-wide text-shred-text">Avancement de la semaine</h2>
          <span className="font-mono text-sm text-shred-accent3">
            Semaine {week} / {PROGRAM_WEEKS}
          </span>
        </div>
        <div className="h-3 rounded-shred bg-shred-surface2 border border-shred-border overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-shred-accent3 to-shred-accent"
            style={{ width: `${weekPct}%` }}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Objectif calories"
          value={`${macros.calories}`}
          subtitle="kcal (type de jour sélectionné)"
          border="accent"
        />
        <StatCard title="Objectif protéines" value={`${macros.protein} g`} subtitle="minimum quotidien" border="accent3" />
        <StatCard
          title="Poids le plus récent"
          value={latest?.weight != null ? `${latest.weight} kg` : `${USER.startWeightKg} kg`}
          subtitle={latest?.date ? `saisi le ${latest.date}` : "défaut / aucune saisie"}
          border="muted"
        />
        <StatCard
          title="Masse grasse la plus récente"
          value={latest?.body_fat != null ? `${latest.body_fat}%` : `${USER.bodyFatPct}%`}
          subtitle="dernière entrée quotidienne"
          border="accent2"
        />
      </section>

      <section className="rounded-shred border border-shred-border bg-shred-surface p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-xl tracking-wide">Vue macros</h2>
            <p className="text-sm text-shred-muted mt-1">Change le type de jour — glucides et calories se mettent à jour.</p>
          </div>
          <div className="flex rounded-shred border border-shred-border overflow-hidden font-mono text-sm">
            <button
              type="button"
              onClick={() => setDayMode("training")}
              className={`px-4 py-2 flex-1 sm:flex-none transition-colors ${
                dayMode === "training"
                  ? "bg-shred-accent text-shred-bg"
                  : "bg-shred-surface2 text-shred-muted hover:text-shred-text"
              }`}
            >
              Jour d&apos;entraînement
            </button>
            <button
              type="button"
              onClick={() => setDayMode("rest")}
              className={`px-4 py-2 flex-1 sm:flex-none border-l border-shred-border transition-colors ${
                dayMode === "rest"
                  ? "bg-shred-accent text-shred-bg"
                  : "bg-shred-surface2 text-shred-muted hover:text-shred-text"
              }`}
            >
              Jour de repos
            </button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <MacroBar label="Protéines" current={0} target={macros.protein} unit="g" colorClass="bg-shred-accent3" />
          <MacroBar label="Glucides" current={0} target={macros.carbs} unit="g" colorClass="bg-shred-accent" />
          <MacroBar label="Lipides" current={0} target={macros.fat} unit="g" colorClass="bg-shred-accent2" />
          <MacroBar label="Calories" current={0} target={macros.calories} unit=" kcal" colorClass="bg-shred-muted" />
        </div>
        <p className="text-xs text-shred-muted mt-4 font-mono">
          Cibles : {dayMode === "training" ? "2 250 kcal · 150 g glucides" : "2 100 kcal · 100 g glucides"} · protéines
          210 g · lipides 100 g
        </p>
      </section>

      <section className="rounded-shred border border-shred-border bg-shred-surface p-4 sm:p-5">
        <h2 className="font-display text-xl tracking-wide mb-4">Projection de poids</h2>
        <p className="text-sm text-shred-muted mb-4">
          Modèle linéaire {USER.startWeightKg} kg → {USER.goalWeightKg} kg sur {PROGRAM_WEEKS} semaines.
        </p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projection} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222228" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: "#666670", fontSize: 11, fontFamily: "var(--font-jetbrains)" }} />
              <YAxis
                domain={[USER.goalWeightKg - 4, USER.startWeightKg + 2]}
                tick={{ fill: "#666670", fontSize: 11, fontFamily: "var(--font-jetbrains)" }}
                width={42}
              />
              <Tooltip
                contentStyle={{
                  background: "#111114",
                  border: "1px solid #222228",
                  borderRadius: 12,
                  color: "#f0f0f0",
                  fontFamily: "var(--font-jetbrains)",
                }}
                labelStyle={{ color: "#e8ff3b" }}
                formatter={(v: number) => [`${v} kg`, "Projection"]}
              />
              <Bar dataKey="kg" fill="#3bffd4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-3">
        {rules.map((r) => (
          <div
            key={r.title}
            className={`rounded-shred border border-shred-border bg-shred-surface2 p-4 border-t-4 ${r.edge}`}
          >
            <h3 className="font-display text-lg tracking-wide text-shred-text">{r.title}</h3>
            <p className="text-sm text-shred-muted mt-2 leading-relaxed">{r.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
