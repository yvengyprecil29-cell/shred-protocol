"use client";

const PREFIX = "shred_protocol_";

function key(name: string) {
  return `${PREFIX}${name}`;
}

function read<T>(name: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key(name));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(name: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

export const localStore = {
  getDailyLogs: () => read<unknown[]>("daily_logs", []),
  setDailyLogs: (v: unknown[]) => write("daily_logs", v),
  getSessions: () => read<unknown[]>("sessions", []),
  setSessions: (v: unknown[]) => write("sessions", v),
  getExercises: () => read<Record<string, unknown[]>>("exercises_by_session", {}),
  setExercises: (v: Record<string, unknown[]>) => write("exercises_by_session", v),
  getWorkoutLogs: () => read<unknown[]>("workout_logs", []),
  setWorkoutLogs: (v: unknown[]) => write("workout_logs", v),
  getWalks: () => read<unknown[]>("walks", []),
  setWalks: (v: unknown[]) => write("walks", v),
  getWhoop: () => read<unknown[]>("whoop", []),
  setWhoop: (v: unknown[]) => write("whoop", v),
  getFoodItems: () => read<Record<string, unknown[]>>("food_by_log", {}),
  setFoodItems: (v: Record<string, unknown[]>) => write("food_by_log", v),
};

export function nextLocalId(items: { id?: number }[]): number {
  const max = items.reduce((m, x) => (typeof x.id === "number" ? Math.max(m, x.id) : m), 0);
  return max + 1;
}
