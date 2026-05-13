"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MACRO_REST, MACRO_TRAINING, PROTEIN_OK_THRESHOLD, USER } from "@/lib/constants";
import type { DailyLog, ExerciseRow, SessionRow, WorkoutLogRow } from "@/lib/types";

type SessionWithEx = SessionRow & { exercises?: ExerciseRow[] };
import { localStore } from "@/lib/localStore";

function targetCals(day: string): number {
  return day === "rest" ? MACRO_REST.calories : MACRO_TRAINING.calories;
}

// ─── Exercise stat types ──────────────────────────────────────────────────────

type ExerciseStat = {
  name: string;
  muscle: string;
  lastDate: string;
  bestSet: WorkoutLogRow | null;
  trend: "up" | "down" | "same";
  weightDiff: number;
  isPR: boolean;
  sessionCount: number;
};

function computeExerciseStats(wl: WorkoutLogRow[], sessions: SessionWithEx[]): ExerciseStat[] {
  const sessionNameMap: Record<number, string> = {};
  for (const s of sessions) {
    sessionNameMap[s.id] = s.name || s.type || "AUTRE";
  }

  // Map exercise name → session name for exercises defined in sessions
  const exerciseSessionMap: Record<string, string> = {};
  for (const s of sessions) {
    if (!(s.template)) {
      const muscle = s.name || s.type || "AUTRE";
      for (const ex of s.exercises ?? []) {
        if (!exerciseSessionMap[ex.name]) exerciseSessionMap[ex.name] = muscle;
      }
    }
  }

  const byExercise: Record<string, WorkoutLogRow[]> = {};
  for (const r of wl) {
    if (!byExercise[r.exercise_name]) byExercise[r.exercise_name] = [];
    byExercise[r.exercise_name].push(r);
  }

  // Add exercises defined in non-template sessions but never logged yet
  for (const s of sessions) {
    if (!s.template) {
      for (const ex of s.exercises ?? []) {
        if (!byExercise[ex.name]) byExercise[ex.name] = [];
      }
    }
  }

  return Object.entries(byExercise).map(([name, rows]) => {
    if (rows.length === 0) {
      return {
        name,
        muscle: exerciseSessionMap[name] ?? "AUTRE",
        lastDate: "",
        bestSet: null,
        trend: "same" as const,
        weightDiff: 0,
        isPR: false,
        sessionCount: 0,
      };
    }
    const dates = [...new Set(rows.map((r) => r.date))].sort((a, b) => b.localeCompare(a));
    const lastDate = dates[0] ?? "";
    const prevDate = dates[1];
    const lastRows = rows.filter((r) => r.date === lastDate);
    const prevRows = prevDate ? rows.filter((r) => r.date === prevDate) : [];
    const lastVol = lastRows.reduce((s, r) => s + r.weight_kg * (Number(r.reps_done) || 0), 0);
    const prevVol = prevRows.reduce((s, r) => s + r.weight_kg * (Number(r.reps_done) || 0), 0);
    const lastMaxW = Math.max(...lastRows.map((r) => r.weight_kg), 0);
    const prevMaxW = prevRows.length ? Math.max(...prevRows.map((r) => r.weight_kg), 0) : 0;
    const allTimeMax = Math.max(...rows.map((r) => r.weight_kg), 0);
    const bestSet = lastRows.reduce<WorkoutLogRow | null>((best, r) => !best || r.weight_kg > best.weight_kg ? r : best, null);
    const trend = prevVol === 0 ? "same" : lastVol > prevVol * 1.01 ? "up" : lastVol < prevVol * 0.99 ? "down" : "same";
    const isPR = prevMaxW > 0 && lastMaxW > prevMaxW && lastMaxW >= allTimeMax;
    const latestRow = rows.reduce((a, b) => (a.date >= b.date ? a : b), rows[0]);
    // Prefer session definition mapping; fall back to workout_log session_id
    const muscle = exerciseSessionMap[name] ?? sessionNameMap[latestRow.session_id] ?? "AUTRE";
    return {
      name,
      muscle,
      lastDate,
      bestSet,
      trend,
      weightDiff: Math.round((lastMaxW - prevMaxW) * 10) / 10,
      isPR,
      sessionCount: dates.length,
    };
  });
}

// ─── Accordion component ──────────────────────────────────────────────────────

function ExerciseAccordion({ wl, sessions }: { wl: WorkoutLogRow[]; sessions: SessionWithEx[] }) {
  const [open, setOpen] = useState<string | null>(null);

  const stats = useMemo(() => computeExerciseStats(wl, sessions), [wl, sessions]);

  const byMuscle = useMemo(() => {
    const map: Record<string, ExerciseStat[]> = {};
    for (const ex of stats) {
      if (!map[ex.muscle]) map[ex.muscle] = [];
      map[ex.muscle].push(ex);
    }
    for (const arr of Object.values(map)) arr.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return map;
  }, [stats]);

  const orderedMuscles = useMemo(
    () => Object.keys(byMuscle).sort((a, b) => a.localeCompare(b, "fr")),
    [byMuscle],
  );

  if (orderedMuscles.length === 0) {
    return <p className="text-sm text-shred-muted font-mono">Aucune donnée d&apos;entraînement. Commence à logger tes séances.</p>;
  }

  return (
    <div className="space-y-2">
      {orderedMuscles.map((muscle) => {
        const exercises = byMuscle[muscle];
        const isOpen = open === muscle;
        return (
          <div key={muscle} className="rounded-shred border border-shred-border overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : muscle)}
              className="w-full flex items-center justify-between px-4 py-3 bg-shred-surface hover:bg-shred-surface2 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-display text-lg">{muscle}</span>
                <span className="font-mono text-xs text-shred-muted bg-shred-surface2 px-2 py-0.5 rounded-full border border-shred-border">
                  {exercises.length} exercice{exercises.length > 1 ? "s" : ""}
                </span>
              </div>
              <span className="font-mono text-shred-muted text-sm">{isOpen ? "▼" : "▶"}</span>
            </button>

            {isOpen && (
              <div className="border-t border-shred-border bg-shred-surface2 divide-y divide-shred-border/30">
                {exercises.map((ex) => (
                  <div key={ex.name} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm text-shred-text truncate">{ex.name}</p>
                        <p className="text-xs text-shred-muted font-mono mt-0.5">
                          {ex.bestSet
                            ? `Dernier : ${ex.bestSet.weight_kg} kg × ${ex.bestSet.reps_done}`
                            : "Aucune donnée"}
                          {ex.lastDate ? ` · ${ex.lastDate.slice(5)}` : ""}
                        </p>
                        <p className="text-[10px] text-shred-muted/50 font-mono">{ex.sessionCount} séance{ex.sessionCount > 1 ? "s" : ""}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {ex.isPR && (
                          <span className="font-mono text-[10px] text-shred-accent bg-shred-accent/10 border border-shred-accent/30 px-1.5 py-0.5 rounded">
                            PR 🏆
                          </span>
                        )}
                        <span className={`font-mono text-sm font-bold ${
                          ex.trend === "up" ? "text-shred-accent3" : ex.trend === "down" ? "text-shred-accent2" : "text-shred-muted"
                        }`}>
                          {ex.trend === "up"
                            ? `↑${ex.weightDiff > 0 ? ` +${ex.weightDiff}kg` : " vol."}`
                            : ex.trend === "down"
                            ? "↓"
                            : "="}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ProgressTab() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [wl, setWl] = useState<WorkoutLogRow[]>([]);
  const [walks, setWalks] = useState<{ date: string }[]>([]);
  const [sessions, setSessions] = useState<SessionWithEx[]>([]);
  const [pickExercise, setPickExercise] = useState("");

  const load = useCallback(async () => {
    const [lr, wr, wk, sr] = await Promise.all([
      fetch("/api/logs"),
      fetch("/api/walks"),
      fetch("/api/workout-logs"),
      fetch("/api/sessions"),
    ]);
    const [lj, wj, kj, sj] = await Promise.all([lr.json(), wr.json(), wk.json(), sr.json()]);
    if (lr.ok && lj.ok) setLogs(lj.data as DailyLog[]);
    else setLogs(localStore.getDailyLogs() as DailyLog[]);
    if (wr.ok && wj.ok) setWalks(wj.data as { date: string }[]);
    else setWalks(localStore.getWalks() as { date: string }[]);
    if (wk.ok && kj.ok) setWl(kj.data as WorkoutLogRow[]);
    else setWl(localStore.getWorkoutLogs() as WorkoutLogRow[]);
    if (sr.ok && sj.ok) setSessions(sj.data as SessionWithEx[]);
    else setSessions(localStore.getSessions() as SessionWithEx[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [logs],
  );

  const weightSeries = useMemo(() => {
    const pts = sortedLogs
      .filter((l) => l.weight != null)
      .map((l) => ({ date: l.date.slice(5), kg: l.weight as number }));
    return pts.map((d, i, arr) => {
      const window = arr.slice(Math.max(0, i - 6), i + 1);
      const ma7 = Math.round((window.reduce((s, x) => s + x.kg, 0) / window.length) * 10) / 10;
      return { ...d, ma7: window.length >= 3 ? ma7 : undefined };
    });
  }, [sortedLogs]);

  const bfSeries = useMemo(
    () =>
      sortedLogs
        .filter((l) => l.body_fat != null)
        .map((l) => ({ date: l.date.slice(5), bf: l.body_fat as number })),
    [sortedLogs],
  );

  const proteinCompliance = useMemo(() => {
    if (!sortedLogs.length) return [];
    const months = new Map<string, { hit: number; total: number }>();
    sortedLogs.forEach((l) => {
      const key = l.date.slice(0, 7);
      const bucket = months.get(key) ?? { hit: 0, total: 0 };
      bucket.total += 1;
      if ((l.protein ?? 0) >= PROTEIN_OK_THRESHOLD) bucket.hit += 1;
      months.set(key, bucket);
    });
    return [...months.entries()].map(([k, v]) => ({
      label: k,
      pct: Math.round((v.hit / Math.max(1, v.total)) * 100),
    }));
  }, [sortedLogs]);

  const weeklyCalories = useMemo(() => {
    const map = new Map<string, { sum: number; n: number; target: number }>();
    sortedLogs.forEach((l) => {
      const key = l.date.slice(0, 7);
      const t = targetCals(l.day_type);
      const b = map.get(key) ?? { sum: 0, n: 0, target: 0 };
      b.sum += l.calories ?? 0;
      b.n += 1;
      b.target += t;
      map.set(key, b);
    });
    return [...map.entries()].map(([k, v]) => ({
      label: k,
      avg: v.n ? Math.round(v.sum / v.n) : 0,
      targetAvg: v.n ? Math.round(v.target / v.n) : 0,
    }));
  }, [sortedLogs]);

  const exerciseNames = useMemo(() => {
    const s = new Set<string>();
    wl.forEach((r) => s.add(r.exercise_name));
    return [...s].sort();
  }, [wl]);

  useEffect(() => {
    if (!pickExercise && exerciseNames.length) setPickExercise(exerciseNames[0]);
  }, [exerciseNames, pickExercise]);

  const overloadSeries = useMemo(() => {
    if (!pickExercise) return [];
    const byDate = new Map<string, number>();
    wl.filter((r) => r.exercise_name === pickExercise).forEach((r) => {
      const cur = byDate.get(r.date) ?? 0;
      byDate.set(r.date, Math.max(cur, r.weight_kg));
    });
    return [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, w]) => ({ date: date.slice(5), w }));
  }, [wl, pickExercise]);

  const prTable = useMemo(() => {
    const m = new Map<string, number>();
    wl.forEach((r) => {
      const cur = m.get(r.exercise_name) ?? 0;
      m.set(r.exercise_name, Math.max(cur, r.weight_kg));
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [wl]);

  const streak = useMemo(() => {
    const dates = new Set(logs.map((l) => l.date));
    let s = 0;
    let d = new Date();
    for (let i = 0; i < 400; i++) {
      const key = format(d, "yyyy-MM-dd");
      if (dates.has(key)) {
        s += 1;
        d = subDays(d, 1);
      } else break;
    }
    return s;
  }, [logs]);

  const walksThisMonth = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    return walks.filter((w) => w.date.startsWith(prefix)).length;
  }, [walks]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl tracking-[0.08em]">Progression et stats</h1>
        <p className="text-shred-muted mt-2">Graphiques à partir de tes saisies.</p>
      </header>

      <section className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-shred border border-shred-border bg-shred-surface p-4 border-t-4 border-t-shred-accent">
          <p className="font-mono text-xs text-shred-muted">Série de jours saisis</p>
          <p className="font-display text-4xl mt-1">{streak} jours</p>
        </div>
        <div className="rounded-shred border border-shred-border bg-shred-surface p-4 border-t-4 border-t-shred-accent3">
          <p className="font-mono text-xs text-shred-muted">Marches rapides ce mois-ci</p>
          <p className="font-display text-4xl mt-1">{walksThisMonth}</p>
        </div>
      </section>

      <section className="rounded-shred border border-shred-border bg-shred-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">Poids</h2>
          <div className="flex items-center gap-3 font-mono text-[10px] text-shred-muted">
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-shred-accent" />Poids</span>
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-shred-accent3 opacity-70" style={{ backgroundImage: "repeating-linear-gradient(90deg,#3bffd4 0,#3bffd4 3px,transparent 3px,transparent 6px)" }} />Moy. 7j</span>
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-shred-accent/40" style={{ backgroundImage: "repeating-linear-gradient(90deg,#e8ff3b 0,#e8ff3b 4px,transparent 4px,transparent 8px)" }} />Objectif</span>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weightSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222228" />
              <XAxis dataKey="date" tick={{ fill: "#666670", fontSize: 11 }} />
              <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fill: "#666670", fontSize: 11 }} width={40} />
              <Tooltip
                contentStyle={{ background: "#111114", border: "1px solid #222228", borderRadius: 12, fontFamily: "var(--font-jetbrains)", fontSize: 11 }}
                formatter={(v: number, name: string) => [
                  `${v} kg`,
                  name === "kg" ? "Poids" : "Moy. 7 jours",
                ]}
              />
              <ReferenceLine
                y={USER.goalWeightKg}
                stroke="#e8ff3b"
                strokeDasharray="5 5"
                strokeOpacity={0.35}
                label={{ value: `${USER.goalWeightKg} kg`, position: "insideTopRight", fill: "#e8ff3b", fontSize: 9, opacity: 0.6, fontFamily: "var(--font-jetbrains)" }}
              />
              <Line type="monotone" dataKey="kg" stroke="#e8ff3b" strokeWidth={2} dot={{ r: 2 }} name="Poids" />
              <Line type="monotone" dataKey="ma7" stroke="#3bffd4" strokeWidth={1.5} dot={false} strokeDasharray="3 3" strokeOpacity={0.7} name="Moy. 7j" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {bfSeries.length ? (
        <section className="rounded-shred border border-shred-border bg-shred-surface p-4">
          <h2 className="font-display text-xl mb-3">Masse grasse %</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bfSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222228" />
                <XAxis dataKey="date" tick={{ fill: "#666670", fontSize: 11 }} />
                <YAxis tick={{ fill: "#666670", fontSize: 11 }} width={36} />
                <Tooltip
                  contentStyle={{ background: "#111114", border: "1px solid #222228", borderRadius: 12 }}
                  formatter={(v: number) => [`${v}%`, "Masse grasse"]}
                />
                <Line type="monotone" dataKey="bf" stroke="#ff4d4d" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : (
        <p className="text-sm text-shred-muted">Saisis la masse grasse dans Quotidien pour afficher le graphique.</p>
      )}

      <section className="rounded-shred border border-shred-border bg-shred-surface p-4">
        <h2 className="font-display text-xl mb-3">
          Respect objectif protéines par mois (jours ≥ {PROTEIN_OK_THRESHOLD} g)
        </h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={proteinCompliance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222228" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#666670", fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#666670", fontSize: 11 }} width={32} />
              <Tooltip
                contentStyle={{ background: "#111114", border: "1px solid #222228", borderRadius: 12 }}
                formatter={(v: number) => [`${v}%`, "Jours atteints"]}
              />
              <Bar dataKey="pct" fill="#3bffd4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-shred border border-shred-border bg-shred-surface p-4">
        <h2 className="font-display text-xl mb-3">Calories moyennes mensuelles vs cible</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyCalories}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222228" />
              <XAxis dataKey="label" tick={{ fill: "#666670", fontSize: 10 }} />
              <YAxis tick={{ fill: "#666670", fontSize: 11 }} width={44} />
              <Tooltip contentStyle={{ background: "#111114", border: "1px solid #222228", borderRadius: 12 }} />
              <Line type="monotone" dataKey="avg" name="Moy. kcal" stroke="#e8ff3b" strokeWidth={2} dot />
              <Line type="monotone" dataKey="targetAvg" name="Cible moy." stroke="#666670" strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-shred border border-shred-border bg-shred-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-xl">Surcharge progressive</h2>
          <select
            value={pickExercise}
            onChange={(e) => setPickExercise(e.target.value)}
            className="rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-sm"
          >
            {exerciseNames.length === 0 ? <option value="">Aucune donnée</option> : null}
            {exerciseNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={overloadSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222228" />
              <XAxis dataKey="date" tick={{ fill: "#666670", fontSize: 11 }} />
              <YAxis tick={{ fill: "#666670", fontSize: 11 }} width={40} />
              <Tooltip
                contentStyle={{ background: "#111114", border: "1px solid #222228", borderRadius: 12 }}
                formatter={(v: number) => [`${v} kg`, pickExercise]}
              />
              <Line type="monotone" dataKey="w" stroke="#3bffd4" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Accordion par séance */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-2xl tracking-wide">Exercices par séance</h2>
          <p className="text-xs text-shred-muted font-mono mt-1">
            Clique sur une séance pour voir les exercices · ↑ progression · ↓ régression · = stable · 🏆 nouveau PR
          </p>
        </div>
        <ExerciseAccordion wl={wl} sessions={sessions} />
      </section>

      <section className="rounded-shred border border-shred-border bg-shred-surface overflow-x-auto">
        <h2 className="font-display text-xl p-4 pb-0">Records personnels (meilleure charge)</h2>
        <table className="min-w-full text-left text-sm mt-2">
          <thead className="bg-shred-surface2 font-mono text-xs uppercase text-shred-muted">
            <tr>
              <th className="px-3 py-2">Exercice</th>
              <th className="px-3 py-2">Max (kg)</th>
            </tr>
          </thead>
          <tbody>
            {prTable.map(([name, w]) => (
              <tr key={name} className="border-t border-shred-border">
                <td className="px-3 py-2">{name}</td>
                <td className="px-3 py-2 font-mono text-shred-accent3">{w}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
