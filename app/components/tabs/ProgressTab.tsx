"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MACRO_REST, MACRO_TRAINING, PROTEIN_OK_THRESHOLD } from "@/lib/constants";
import type { DailyLog, WorkoutLogRow } from "@/lib/types";
import { localStore } from "@/lib/localStore";

function targetCals(day: string): number {
  return day === "rest" ? MACRO_REST.calories : MACRO_TRAINING.calories;
}

export function ProgressTab() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [wl, setWl] = useState<WorkoutLogRow[]>([]);
  const [walks, setWalks] = useState<{ date: string }[]>([]);
  const [pickExercise, setPickExercise] = useState("");

  const load = useCallback(async () => {
    const [lr, wr, wk] = await Promise.all([
      fetch("/api/logs"),
      fetch("/api/walks"),
      fetch("/api/workout-logs"),
    ]);
    const [lj, wj, kj] = await Promise.all([lr.json(), wr.json(), wk.json()]);
    if (lr.ok && lj.ok) setLogs(lj.data as DailyLog[]);
    else setLogs(localStore.getDailyLogs() as DailyLog[]);
    if (wr.ok && wj.ok) setWalks(wj.data as { date: string }[]);
    else setWalks(localStore.getWalks() as { date: string }[]);
    if (wk.ok && kj.ok) setWl(kj.data as WorkoutLogRow[]);
    else setWl(localStore.getWorkoutLogs() as WorkoutLogRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedLogs = useMemo(
    () => [...logs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [logs],
  );

  const weightSeries = useMemo(
    () =>
      sortedLogs
        .filter((l) => l.weight != null)
        .map((l) => ({ date: l.date.slice(5), kg: l.weight as number })),
    [sortedLogs],
  );

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
        <h2 className="font-display text-xl mb-3">Poids</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weightSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222228" />
              <XAxis dataKey="date" tick={{ fill: "#666670", fontSize: 11 }} />
              <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fill: "#666670", fontSize: 11 }} width={40} />
              <Tooltip
                contentStyle={{ background: "#111114", border: "1px solid #222228", borderRadius: 12 }}
                formatter={(v: number) => [`${v} kg`, "Poids"]}
              />
              <Line type="monotone" dataKey="kg" stroke="#e8ff3b" strokeWidth={2} dot={{ r: 2 }} />
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
