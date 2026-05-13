"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MACRO_TRAINING, PROGRAM_WEEKS, USER } from "@/lib/constants";
import { programWeekNumber } from "@/lib/dates";
import type { DailyLog } from "@/lib/types";
import { localStore } from "@/lib/localStore";
import { Skeleton, SkeletonRing } from "../ui/Skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────

type TodaySummary = {
  sessions: { id: number; name: string; type: string }[];
  walk: { duration_minutes: number; distance_km: number | null } | null;
  food_totals: { calories: number; protein: number; carbs: number; fat: number } | null;
};

// ─── SVG Ring ─────────────────────────────────────────────────────────────────

function Ring({
  value, max, color, size = 88, sw = 7,
}: { value: number; max: number; color: string; size?: number; sw?: number }) {
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#18181d" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)" }}
        opacity={value > max ? 0.65 : 1}
      />
    </svg>
  );
}

function MacroRing({
  label, value, max, color, unit,
}: { label: string; value: number; max: number; color: string; unit: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const over = value > max;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: 88, height: 88 }}>
        <Ring value={value} max={max} color={color} />
        <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
          <span className="font-display text-xl leading-none">{pct}</span>
          <span className="font-mono text-[9px] text-shred-muted leading-none mt-0.5">%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="font-mono text-[9px] uppercase tracking-wider text-shred-muted">{label}</p>
        <p className="font-mono text-[10px] mt-0.5 tabular-nums">
          <span className={over ? "text-shred-accent2" : "text-shred-text"}>{Math.round(value)}</span>
          <span className="text-shred-muted">/{max}{unit}</span>
        </p>
      </div>
    </div>
  );
}

// ─── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, loading }: { score: number; loading: boolean }) {
  const size = 128;
  const sw = 10;
  const color = score >= 75 ? "#3bffd4" : score >= 50 ? "#e8ff3b" : "#ff4d4d";
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-full bg-shred-surface2 skeleton-shimmer relative overflow-hidden" style={{ width: size, height: size }} />
        <Skeleton className="h-3 w-24 mt-1" />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <Ring value={score} max={100} color={color} size={size} sw={sw} />
        <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
          <span className="font-display text-5xl leading-none" style={{ color }}>{score}</span>
          <span className="font-mono text-[10px] text-shred-muted mt-0.5">/100</span>
        </div>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-shred-muted mt-2">Score du jour</p>
    </div>
  );
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6)  return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 14) return "Bon midi";
  if (h < 19) return "Bon après-midi";
  if (h < 22) return "Bonne soirée";
  return "Bonne nuit";
}

function getSub(h: number, today: TodaySummary | null): string {
  if (h < 10) return "Commence bien ta journée — protéines au premier repas.";
  if (h < 14 && !today?.sessions.length) return "Séance prévue aujourd'hui ? Clique sur Entraînement.";
  if (today?.sessions.length && !today.walk) return "Séance ✓ — pense à la marche post-gym.";
  if (today?.sessions.length && today.walk) return "Séance + marche ✓ — belle journée.";
  if (h > 20) return "Check les macros avant de finir ta journée.";
  return "Continue sur ta lancée.";
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OverviewTab({ sessionRefreshKey = 0 }: { sessionRefreshKey?: number }) {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [today, setToday] = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/logs", { cache: "no-store" });
        const j = await res.json();
        setLogs(res.ok && j.ok ? j.data as DailyLog[] : localStore.getDailyLogs() as DailyLog[]);
      } catch { setLogs(localStore.getDailyLogs() as DailyLog[]); }
    })();
  }, []);

  const loadToday = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10);
    fetch(`/api/today-summary?date=${date}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { ok: boolean; data?: TodaySummary }) => {
        if (j.ok && j.data) setToday(j.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch on mount and whenever a session mutation is broadcast from another tab
  useEffect(() => { loadToday(); }, [loadToday, sessionRefreshKey]);

  // Refetch when the browser tab becomes visible again (user switched to training, made changes, came back)
  useEffect(() => {
    function onVisible() { if (document.visibilityState === "visible") loadToday(); }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadToday]);

  // 30 s polling keeps the dashboard live without any manual action
  useEffect(() => {
    const id = setInterval(loadToday, 30_000);
    return () => clearInterval(id);
  }, [loadToday]);

  const latest = useMemo(
    () => [...logs].sort((a, b) => (a.date < b.date ? 1 : -1))[0],
    [logs],
  );

  const ft = today?.food_totals;
  const week = programWeekNumber(USER.startDate);

  // Daily score 0-100
  const score = useMemo(() => {
    let s = 0;
    if (ft) {
      s += Math.round(Math.min(25, (ft.protein / MACRO_TRAINING.protein) * 25));
      const calPct = ft.calories / MACRO_TRAINING.calories;
      s += Math.round(Math.max(0, 25 * (1 - Math.abs(calPct - 1) * 3)));
    }
    if (today?.sessions.length) s += 25;
    if (today?.walk) s += 25;
    return Math.min(100, s);
  }, [ft, today]);

  // Weight progress
  const currentWeight = latest?.weight ?? USER.startWeightKg;
  const lostKg = parseFloat(Math.max(0, USER.startWeightKg - currentWeight).toFixed(1));
  const toGoKg = USER.startWeightKg - USER.goalWeightKg;
  const weightPct = toGoKg > 0 ? Math.min(100, Math.round((lostKg / toGoKg) * 100)) : 0;

  const now = new Date();
  const h = now.getHours();

  const MACROS = [
    { label: "Protéines", key: "protein" as const, max: MACRO_TRAINING.protein, color: "#3bffd4", unit: "g" },
    { label: "Glucides",  key: "carbs"   as const, max: MACRO_TRAINING.carbs,   color: "#e8ff3b", unit: "g" },
    { label: "Lipides",   key: "fat"     as const, max: MACRO_TRAINING.fat,     color: "#ff4d4d", unit: "g" },
    { label: "Calories",  key: "calories"as const, max: MACRO_TRAINING.calories, color: "#888890", unit: "" },
  ];

  return (
    <div className="space-y-5">

      {/* ── Greeting ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-[0.06em] leading-tight">
          {getGreeting()},<br />
          <span className="text-shred-accent">{USER.name}</span>
        </h1>
        <p className="text-shred-muted text-sm mt-1 font-sans">{getSub(h, today)}</p>
      </div>

      {/* ── Score + status ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-shred-border bg-shred-surface p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing score={score} loading={loading} />

          <div className="flex-1 w-full space-y-3">
            {/* Session */}
            <div className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
              today?.sessions.length
                ? "border-shred-accent3/40 bg-shred-accent3/8"
                : "border-shred-border bg-shred-surface2"
            }`}>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-shred-muted">Séance</p>
                {loading ? (
                  <Skeleton className="h-3.5 w-24 mt-1" />
                ) : today?.sessions.length ? (
                  <p className="font-mono text-sm text-shred-accent3 mt-0.5">
                    ✓ {today.sessions.map((s) => s.name).join(", ")}
                  </p>
                ) : (
                  <p className="font-mono text-sm text-shred-muted/50 mt-0.5">Non enregistrée</p>
                )}
              </div>
              <span className={`font-display text-2xl ${today?.sessions.length ? "text-shred-accent3" : "text-shred-border"}`}>
                {today?.sessions.length ? "✓" : "○"}
              </span>
            </div>

            {/* Walk */}
            <div className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
              today?.walk
                ? "border-shred-accent3/40 bg-shred-accent3/8"
                : "border-shred-border bg-shred-surface2"
            }`}>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-shred-muted">Marche</p>
                {loading ? (
                  <Skeleton className="h-3.5 w-20 mt-1" />
                ) : today?.walk ? (
                  <p className="font-mono text-sm text-shred-accent3 mt-0.5">
                    ✓ {today.walk.duration_minutes} min{today.walk.distance_km ? ` · ${today.walk.distance_km} km` : ""}
                  </p>
                ) : (
                  <p className="font-mono text-sm text-shred-muted/50 mt-0.5">Non enregistrée</p>
                )}
              </div>
              <span className={`font-display text-2xl ${today?.walk ? "text-shred-accent3" : "text-shred-border"}`}>
                {today?.walk ? "✓" : "○"}
              </span>
            </div>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="mt-4 pt-4 border-t border-shred-border/40 grid grid-cols-4 gap-2 text-center">
          {[
            { label: "Séance", pts: today?.sessions.length ? 25 : 0 },
            { label: "Marche",  pts: today?.walk ? 25 : 0 },
            { label: "Protéines", pts: ft ? Math.round(Math.min(25, (ft.protein / MACRO_TRAINING.protein) * 25)) : 0 },
            { label: "Calories",  pts: ft ? Math.round(Math.max(0, 25 * (1 - Math.abs(ft.calories / MACRO_TRAINING.calories - 1) * 3))) : 0 },
          ].map(({ label, pts }) => (
            <div key={label}>
              <p className="font-mono text-[9px] text-shred-muted uppercase tracking-wide">{label}</p>
              <p className={`font-display text-xl mt-0.5 ${pts >= 20 ? "text-shred-accent3" : pts > 0 ? "text-shred-accent" : "text-shred-border"}`}>
                {pts}
              </p>
              <p className="font-mono text-[8px] text-shred-muted/40">/25 pts</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Macro rings ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-shred-border bg-shred-surface p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl tracking-wide">Macros</h2>
          {ft ? (
            <span className="font-mono text-[9px] text-shred-accent3 uppercase tracking-widest">Live</span>
          ) : (
            <span className="font-mono text-[9px] text-shred-muted uppercase tracking-widest">Cibles</span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2 justify-items-center">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonRing key={i} />)
          ) : (
            MACROS.map((m) => (
              <MacroRing
                key={m.key}
                label={m.label}
                value={ft ? ft[m.key] : 0}
                max={m.max}
                color={m.color}
                unit={m.unit}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Poids & programme ──────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-3">

        {/* Weight progress */}
        <div className="rounded-2xl border border-shred-border bg-shred-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-shred-muted mb-3">Progression poids</p>
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <p className="font-display text-2xl">{currentWeight} <span className="text-sm text-shred-muted">kg</span></p>
              <p className="font-mono text-[10px] text-shred-muted mt-0.5">actuel</p>
            </div>
            <div className="text-center">
              {lostKg > 0 && (
                <p className="font-mono text-sm text-shred-accent3 font-bold">−{lostKg} kg</p>
              )}
              <p className="font-mono text-[10px] text-shred-muted">{weightPct}% de l'objectif</p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl text-shred-accent">{USER.goalWeightKg} <span className="text-sm text-shred-muted">kg</span></p>
              <p className="font-mono text-[10px] text-shred-muted mt-0.5">objectif</p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-shred-surface2 border border-shred-border overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-shred-accent3 to-shred-accent transition-all duration-700"
              style={{ width: `${weightPct}%` }}
            />
          </div>
          <p className="font-mono text-[9px] text-shred-muted/40 mt-1.5 text-right">{USER.startWeightKg} kg → {USER.goalWeightKg} kg</p>
        </div>

        {/* Programme */}
        <div className="rounded-2xl border border-shred-border bg-shred-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-shred-muted mb-3">Programme</p>
          <div className="flex items-center justify-between mb-2">
            <p className="font-display text-4xl text-shred-accent3">{week}<span className="font-mono text-sm text-shred-muted ml-1">/{PROGRAM_WEEKS}</span></p>
            <p className="font-mono text-xs text-shred-muted">{Math.round((week / PROGRAM_WEEKS) * 100)}%</p>
          </div>
          <div className="h-2 rounded-full bg-shred-surface2 border border-shred-border overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-shred-accent3 to-shred-accent transition-all duration-700"
              style={{ width: `${(week / PROGRAM_WEEKS) * 100}%` }}
            />
          </div>
          <p className="font-mono text-[9px] text-shred-muted/40 mt-1.5">Démarré {USER.startDate} · fin août</p>

          <div className="mt-3 pt-3 border-t border-shred-border/40 grid grid-cols-2 gap-2">
            <div>
              <p className="font-mono text-[9px] text-shred-muted uppercase">Objectif MG</p>
              <p className="font-mono text-sm text-shred-text">{USER.goalBodyFatPctLow}–{USER.goalBodyFatPctHigh}%</p>
            </div>
            <div>
              <p className="font-mono text-[9px] text-shred-muted uppercase">MG actuelle</p>
              <p className="font-mono text-sm text-shred-text">{latest?.body_fat ?? USER.bodyFatPct}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Règles rapides ─────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-3 gap-2.5">
        {[
          { t: "Protéines d'abord", b: "210 g/j — structure chaque repas autour d'une source complète.", c: "border-t-shred-accent3" },
          { t: "Glucides peri-workout", b: "Jours training : avant + après séance. Repos : max 100 g.", c: "border-t-shred-accent" },
          { t: "Lipides = stabilité", b: "Olive, poisson, œufs, avocat. Indispensables pendant la sèche.", c: "border-t-shred-accent2" },
        ].map((r) => (
          <div key={r.t} className={`rounded-xl border border-shred-border bg-shred-surface2 p-3.5 border-t-4 ${r.c}`}>
            <h3 className="font-display text-base tracking-wide">{r.t}</h3>
            <p className="text-xs text-shred-muted mt-1.5 leading-relaxed">{r.b}</p>
          </div>
        ))}
      </div>


    </div>
  );
}
