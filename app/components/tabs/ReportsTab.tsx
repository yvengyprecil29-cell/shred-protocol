"use client";

import { useEffect, useState } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import type { DailyLog, WhoopRow, WorkoutLogRow, SessionRow } from "@/lib/types";
import { SESSION_TYPE_LABELS } from "@/lib/constants";
import { USER, MACRO_TRAINING } from "@/lib/constants";

type SessionWithEx = SessionRow & { exercises: { name: string }[] };

async function get<T>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url);
    const j = await res.json();
    return j.ok ? (j.data as T[]) : [];
  } catch { return []; }
}

function vol(rows: WorkoutLogRow[]) {
  return rows.reduce((s, r) => s + r.weight_kg * (Number(r.reps_done) || 0), 0);
}

function inRange(date: string, from: Date, to: Date) {
  const d = new Date(date + "T12:00:00");
  return d >= from && d <= to;
}

type PeriodReport = {
  label: string;
  from: Date;
  to: Date;
  sessions: number;
  volumeByType: Record<string, number>;
  totalVolume: number;
  avgProtein: number;
  avgCalories: number;
  avgRecovery: number;
  avgHrv: number;
  prs: { exercise: string; weight: number; reps: string }[];
  daysWithProteinOk: number;
  totalDays: number;
};

function computeReport(label: string, from: Date, to: Date, workouts: WorkoutLogRow[], sessions: SessionWithEx[], logs: DailyLog[], whoop: WhoopRow[]): PeriodReport {
  const wInRange = workouts.filter((w) => inRange(w.date, from, to));
  const lInRange = logs.filter((l) => inRange(l.date, from, to));
  const wInRangeWhoop = whoop.filter((w) => inRange(w.date, from, to));

  const sessionDates = new Set(wInRange.map((w) => w.date));

  const volumeByType: Record<string, number> = {};
  for (const w of wInRange) {
    const s = sessions.find((s) => s.id === w.session_id);
    const type = s ? (SESSION_TYPE_LABELS[s.type as keyof typeof SESSION_TYPE_LABELS] ?? s.type) : "Autre";
    volumeByType[type] = (volumeByType[type] ?? 0) + w.weight_kg * (Number(w.reps_done) || 0);
  }

  // PRs: best weight per exercise during the period
  const byExercise: Record<string, WorkoutLogRow[]> = {};
  for (const w of wInRange) {
    (byExercise[w.exercise_name] = byExercise[w.exercise_name] ?? []).push(w);
  }
  const prs = Object.entries(byExercise).map(([exercise, rows]) => {
    const best = rows.reduce((b, r) => r.weight_kg > b.weight_kg ? r : b, rows[0]);
    return { exercise, weight: best.weight_kg, reps: best.reps_done };
  }).sort((a, b) => b.weight - a.weight).slice(0, 5);

  const avgProtein = lInRange.length ? lInRange.reduce((s, l) => s + (l.protein ?? 0), 0) / lInRange.length : 0;
  const avgCalories = lInRange.length ? lInRange.reduce((s, l) => s + (l.calories ?? 0), 0) / lInRange.length : 0;
  const avgRecovery = wInRangeWhoop.length ? wInRangeWhoop.reduce((s, w) => s + w.recovery_score, 0) / wInRangeWhoop.length : 0;
  const avgHrv = wInRangeWhoop.filter((w) => w.hrv).length ? wInRangeWhoop.filter((w) => w.hrv).reduce((s, w) => s + (w.hrv ?? 0), 0) / wInRangeWhoop.filter((w) => w.hrv).length : 0;
  const daysWithProteinOk = lInRange.filter((l) => (l.protein ?? 0) >= 200).length;

  return {
    label,
    from,
    to,
    sessions: sessionDates.size,
    volumeByType,
    totalVolume: vol(wInRange),
    avgProtein: Math.round(avgProtein),
    avgCalories: Math.round(avgCalories),
    avgRecovery: Math.round(avgRecovery),
    avgHrv: Math.round(avgHrv),
    prs,
    daysWithProteinOk,
    totalDays: lInRange.length,
  };
}

function ReportCard({ r }: { r: PeriodReport }) {
  const maxVol = Math.max(...Object.values(r.volumeByType), 1);
  return (
    <div className="rounded-shred border border-shred-border bg-shred-surface p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl tracking-wide">{r.label}</h3>
        <span className="font-mono text-xs text-shred-muted">{format(r.from, "d MMM", { locale: fr })} → {format(r.to, "d MMM yyyy", { locale: fr })}</span>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Séances", value: r.sessions, unit: "" },
          { label: "Volume total", value: Math.round(r.totalVolume / 1000), unit: "t" },
          { label: "Protéines moy.", value: r.avgProtein, unit: "g" },
          { label: "Récup. WHOOP", value: r.avgRecovery || "—", unit: r.avgRecovery ? "%" : "" },
        ].map((s) => (
          <div key={s.label} className="rounded-shred border border-shred-border bg-shred-surface2 p-3">
            <p className="font-mono text-xs text-shred-muted">{s.label}</p>
            <p className="font-display text-2xl mt-1">{s.value}<span className="text-sm text-shred-muted ml-1">{s.unit}</span></p>
          </div>
        ))}
      </div>

      {/* Volume by type */}
      {Object.keys(r.volumeByType).length > 0 && (
        <div>
          <p className="font-mono text-xs text-shred-muted uppercase tracking-wider mb-2">Volume par groupe musculaire</p>
          <div className="space-y-2">
            {Object.entries(r.volumeByType).sort((a, b) => b[1] - a[1]).map(([type, v]) => (
              <div key={type}>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-shred-text">{type}</span>
                  <span className="text-shred-muted">{Math.round(v / 1000 * 10) / 10}t</span>
                </div>
                <div className="h-2 rounded-shred bg-shred-surface2 overflow-hidden border border-shred-border">
                  <div className="h-full bg-shred-accent3 rounded-shred" style={{ width: `${(v / maxVol) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PRs */}
      {r.prs.length > 0 && (
        <div>
          <p className="font-mono text-xs text-shred-muted uppercase tracking-wider mb-2">Top performances</p>
          <div className="space-y-1">
            {r.prs.map((p) => (
              <div key={p.exercise} className="flex justify-between items-center text-sm font-mono">
                <span className="text-shred-text truncate mr-4">{p.exercise}</span>
                <span className="text-shred-accent3 shrink-0">{p.weight} kg × {p.reps}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nutrition & WHOOP */}
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-shred border border-shred-border bg-shred-surface2 p-3">
          <p className="font-mono text-xs text-shred-muted uppercase mb-2">Nutrition</p>
          <p className="font-mono text-sm">Protéines ≥200g : <span className="text-shred-accent3">{r.daysWithProteinOk}/{r.totalDays} jours</span></p>
          <p className="font-mono text-sm">Calories moy. : <span className="text-shred-text">{r.avgCalories || "—"} kcal</span></p>
          {r.avgCalories > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs font-mono text-shred-muted mb-1">
                <span>Calories vs cible ({MACRO_TRAINING.calories})</span>
                <span>{r.avgCalories > MACRO_TRAINING.calories ? "↑" : "↓"} {Math.abs(r.avgCalories - MACRO_TRAINING.calories)} kcal</span>
              </div>
              <div className="h-1.5 rounded-shred bg-shred-surface overflow-hidden">
                <div className={`h-full rounded-shred ${r.avgCalories > MACRO_TRAINING.calories ? "bg-shred-accent2" : "bg-shred-accent3"}`}
                  style={{ width: `${Math.min((r.avgCalories / MACRO_TRAINING.calories) * 100, 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        {r.avgRecovery > 0 && (
          <div className="rounded-shred border border-shred-border bg-shred-surface2 p-3">
            <p className="font-mono text-xs text-shred-muted uppercase mb-2">WHOOP</p>
            <p className="font-mono text-sm">Récupération moy. : <span className={`${r.avgRecovery >= 67 ? "text-green-400" : r.avgRecovery >= 34 ? "text-yellow-400" : "text-red-400"}`}>{r.avgRecovery}%</span></p>
            {r.avgHrv > 0 && <p className="font-mono text-sm">HRV moy. : <span className="text-shred-text">{r.avgHrv} ms</span></p>}
          </div>
        )}
      </div>

      {r.sessions === 0 && (
        <p className="text-sm text-shred-muted font-mono">Aucune séance enregistrée sur cette période.</p>
      )}
    </div>
  );
}

export function ReportsTab() {
  const [workouts, setWorkouts] = useState<WorkoutLogRow[]>([]);
  const [sessions, setSessions] = useState<SessionWithEx[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [whoop, setWhoop] = useState<WhoopRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [w, s, l, wh] = await Promise.all([
        get<WorkoutLogRow>("/api/workout-logs"),
        get<SessionWithEx>("/api/sessions"),
        get<DailyLog>("/api/logs"),
        get<WhoopRow>("/api/whoop"),
      ]);
      setWorkouts(w);
      setSessions(s);
      setLogs(l);
      setWhoop(wh);
      setLoading(false);
    }
    void load();
  }, []);

  const now = new Date();

  const reports: PeriodReport[] = [
    computeReport("Cette semaine", startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 }), workouts, sessions, logs, whoop),
    computeReport("Semaine dernière", startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), workouts, sessions, logs, whoop),
    computeReport("Ce mois", startOfMonth(now), endOfMonth(now), workouts, sessions, logs, whoop),
    computeReport("Mois dernier", startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1)), workouts, sessions, logs, whoop),
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl tracking-[0.08em]">Comptes rendus</h1>
        <p className="text-shred-muted mt-2 text-sm">
          {USER.name} · Objectif : {USER.goalWeightKg} kg d&apos;ici fin août · Résumés hebdo &amp; mensuel
        </p>
      </header>

      {loading ? (
        <div className="text-shred-muted font-mono text-sm animate-pulse">Chargement des données…</div>
      ) : (
        <div className="space-y-6">
          {reports.map((r) => <ReportCard key={r.label} r={r} />)}
        </div>
      )}
    </div>
  );
}
