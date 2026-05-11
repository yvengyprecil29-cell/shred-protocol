"use client";

import { localStore } from "./localStore";
import type { DailyLog, ExerciseRow, FastWalkRow, SessionRow, WorkoutLogRow, WhoopRow } from "./types";

const MIGRATION_KEY = "shred_migrated_to_turso_v1";

type SessionWithEx = SessionRow & { exercises: ExerciseRow[] };

export async function migrateLocalStorageToTurso(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_KEY)) return;

  const sessions = (localStore.getSessions() as SessionWithEx[]) ?? [];
  const workoutLogs = (localStore.getWorkoutLogs() as WorkoutLogRow[]) ?? [];
  const walks = (localStore.getWalks() as FastWalkRow[]) ?? [];
  const dailyLogs = (localStore.getDailyLogs() as (DailyLog & { food_items?: unknown[] })[]) ?? [];
  const foodByLog = localStore.getFoodItems() as Record<string, unknown[]>;
  const whoop = (localStore.getWhoop() as WhoopRow[]) ?? [];

  if (sessions.length === 0 && dailyLogs.length === 0 && whoop.length === 0) {
    localStorage.setItem(MIGRATION_KEY, "1");
    return;
  }

  const idMap: Record<number, number> = {};

  // Migrate sessions + exercises
  for (const s of sessions) {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: s.name,
          type: s.type,
          date: s.date,
          template: s.template,
          notes: s.notes,
          exercises: (s.exercises ?? []).map((e) => ({
            name: e.name,
            sets: e.sets,
            reps_target: e.reps_target,
            rest_seconds: e.rest_seconds,
            order_index: e.order_index,
            notes: e.notes,
          })),
        }),
      });
      const j = await res.json();
      if (j.ok && j.data?.id) idMap[s.id] = j.data.id;
    } catch {}
  }

  // Migrate workout logs (group by session+date)
  const logGroups: Record<string, WorkoutLogRow[]> = {};
  for (const wl of workoutLogs) {
    const key = `${wl.session_id}_${wl.date}`;
    if (!logGroups[key]) logGroups[key] = [];
    logGroups[key].push(wl);
  }
  for (const [key, rows] of Object.entries(logGroups)) {
    const [oldSessionId, date] = key.split("_");
    const newSessionId = idMap[Number(oldSessionId)];
    if (!newSessionId) continue;
    try {
      await fetch("/api/workout-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: newSessionId,
          date,
          rows: rows.map((r) => ({
            exercise_name: r.exercise_name,
            set_number: r.set_number,
            weight_kg: r.weight_kg,
            reps_done: r.reps_done,
            rpe: r.rpe,
            notes: r.notes,
          })),
        }),
      });
    } catch {}
  }

  // Migrate walks
  for (const w of walks) {
    const newSessionId = idMap[w.session_id];
    if (!newSessionId) continue;
    try {
      await fetch("/api/walks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...w, session_id: newSessionId }),
      });
    } catch {}
  }

  // Migrate daily logs + food items
  for (const log of dailyLogs) {
    const foodItems = log.food_items ?? (foodByLog[String(log.id)] as unknown[]) ?? [];
    try {
      await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...log, food_items: foodItems }),
      });
    } catch {}
  }

  // Migrate whoop
  for (const w of whoop) {
    try {
      await fetch("/api/whoop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(w),
      });
    } catch {}
  }

  localStorage.setItem(MIGRATION_KEY, "1");
}
