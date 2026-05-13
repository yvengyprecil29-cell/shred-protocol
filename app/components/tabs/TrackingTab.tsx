"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { MACRO_REST, MACRO_TRAINING, PROTEIN_OK_THRESHOLD } from "@/lib/constants";
import type { DailyLog, FoodItem, SessionRow } from "@/lib/types";
import { localStore, nextLocalId } from "@/lib/localStore";
import { ConfirmDialog } from "@/app/components/ui/ConfirmDialog";

type LogWithFood = DailyLog & { food_items?: FoodItem[] };
type SessionWithEx = SessionRow & { exercises?: unknown[] };

function targetCals(day: string): number {
  return day === "rest" ? MACRO_REST.calories : MACRO_TRAINING.calories;
}

function statusFor(log: DailyLog): { label: string; ok: boolean } {
  const t = targetCals(log.day_type);
  const p = log.protein ?? 0;
  const c = log.calories ?? 0;
  const ok = p >= PROTEIN_OK_THRESHOLD && (log.calories == null || c <= t);
  return ok ? { label: "✓ OK", ok: true } : { label: "⚠ À revoir", ok: false };
}

export function TrackingTab() {
  const [logs, setLogs] = useState<LogWithFood[]>([]);
  const [sessions, setSessions] = useState<SessionWithEx[]>([]);
  const [showFood, setShowFood] = useState(false);

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [water, setWater] = useState("");
  const [creatine, setCreatine] = useState(false);
  const [notes, setNotes] = useState("");

  const [foods, setFoods] = useState<
    { id?: number; name: string; quantity: string; unit: string; calories: string; protein: string; carbs: string; fat: string }[]
  >([]);

  const [msg, setMsg] = useState<string | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<number | null>(null);

  // ── Auto-fill from today-summary ──────────────────────────────────────────
  type MealTotals = { meal: string | null; calories: number; protein: number; carbs: number; fat: number };
  type TodaySummary = {
    sessions: { id: number; name: string; type: string }[];
    walk: { duration_minutes: number; distance_km: number | null } | null;
    food_totals: { calories: number; protein: number; carbs: number; fat: number; by_meal: MealTotals[] } | null;
  };
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [manualMacros, setManualMacros] = useState(false);

  const loadTodaySummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/today-summary?date=${date}`, { cache: "no-store" });
      const j = await res.json() as { ok: boolean; data?: TodaySummary };
      if (j.ok && j.data) setTodaySummary(j.data);
    } catch { /* ignore */ }
  }, [date]);

  useEffect(() => { void loadTodaySummary(); }, [loadTodaySummary]);

  // Poll every 30 s so the fields update if the user logs a workout in another tab
  useEffect(() => {
    const id = setInterval(() => void loadTodaySummary(), 30_000);
    return () => clearInterval(id);
  }, [loadTodaySummary]);

  // Also refetch whenever the browser tab becomes visible again
  useEffect(() => {
    function onVisible() { if (document.visibilityState === "visible") void loadTodaySummary(); }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadTodaySummary]);

  // Auto-fill macros from food journal whenever summary changes
  useEffect(() => {
    if (!todaySummary) return;
    const ft = todaySummary.food_totals;
    if (ft && !manualMacros) {
      setCalories(ft.calories > 0 ? String(Math.round(ft.calories)) : "");
      setProtein(ft.protein > 0 ? String(Math.round(ft.protein)) : "");
      setCarbs(ft.carbs > 0 ? String(Math.round(ft.carbs)) : "");
      setFat(ft.fat > 0 ? String(Math.round(ft.fat)) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaySummary]);

  // Derived from today-summary — no manual input needed
  const dayType: "training" | "rest" = todaySummary?.sessions && todaySummary.sessions.length > 0 ? "training" : "rest";

  const MEAL_LABELS: Record<string, string> = { meal1: "R1", meal2: "R2", meal3: "R3", meal4: "R4" };

  const load = useCallback(async () => {
    const [lr, sr] = await Promise.all([fetch("/api/logs"), fetch("/api/sessions")]);
    const lj = await lr.json();
    const sj = await sr.json();
    if (lr.ok && lj.ok) setLogs(lj.data as LogWithFood[]);
    else setLogs(localStore.getDailyLogs() as LogWithFood[]);
    if (sr.ok && sj.ok) setSessions(sj.data as SessionWithEx[]);
    else setSessions(localStore.getSessions() as SessionWithEx[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runningTotals = useMemo(() => {
    let fc = 0,
      fp = 0,
      fcb = 0,
      ff = 0;
    foods.forEach((f) => {
      fc += Number(f.calories) || 0;
      fp += Number(f.protein) || 0;
      fcb += Number(f.carbs) || 0;
      ff += Number(f.fat) || 0;
    });
    const mc = Number(calories) || 0;
    const mp = Number(protein) || 0;
    const mcb = Number(carbs) || 0;
    const mf = Number(fat) || 0;
    return {
      calories: mc + fc,
      protein: mp + fp,
      carbs: mcb + fcb,
      fat: mf + ff,
    };
  }, [foods, calories, protein, carbs, fat]);

  const macroTarget = dayType === "training" ? MACRO_TRAINING : MACRO_REST;
  const proteinOk = runningTotals.protein >= 200;
  const calHigh = runningTotals.calories > macroTarget.calories;

  async function deleteLog(id: number) {
    setDeletingLogId(null);
    const res = await fetch(`/api/logs?id=${id}`, { method: "DELETE" });
    const j = await res.json();
    if (res.ok && j.ok) { await load(); return; }
    const all = localStore.getDailyLogs() as LogWithFood[];
    localStore.setDailyLogs(all.filter((x) => x.id !== id));
    await load();
  }

  async function saveEntry() {
    setMsg(null);
    const foodPayload = foods
      .filter((f) => f.name.trim())
      .map((f) => ({
        name: f.name.trim(),
        quantity: f.quantity ? Number(f.quantity) : null,
        unit: f.unit || null,
        calories: f.calories ? Number(f.calories) : null,
        protein: f.protein ? Number(f.protein) : null,
        carbs: f.carbs ? Number(f.carbs) : null,
        fat: f.fat ? Number(f.fat) : null,
      }));

    const body = {
      date,
      weight: weight ? Number(weight) : null,
      body_fat: bodyFat ? Number(bodyFat) : null,
      day_type: dayType,
      session_id: todaySummary?.sessions?.[0]?.id ?? null,
      calories: calories ? Number(calories) : null,
      protein: protein ? Number(protein) : null,
      carbs: carbs ? Number(carbs) : null,
      fat: fat ? Number(fat) : null,
      water: water ? Number(water) : null,
      creatine,
      notes: notes || null,
      food_items: showFood ? foodPayload : [],
    };

    const res = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (res.ok && j.ok) {
      await load();
      setMsg("Enregistré");
      return;
    }

    const all = localStore.getDailyLogs() as LogWithFood[];
    const id = nextLocalId(all);
    const row: LogWithFood = {
      id,
      date,
      weight: body.weight as number | null,
      body_fat: body.body_fat as number | null,
      day_type: dayType,
      session_id: body.session_id as number | null,
      calories: body.calories as number | null,
      protein: body.protein as number | null,
      carbs: body.carbs as number | null,
      fat: body.fat as number | null,
      water: body.water as number | null,
      creatine: creatine ? 1 : 0,
      notes: body.notes,
      food_items: [],
    };
    const foodMap = localStore.getFoodItems();
    if (showFood && foodPayload.length) {
      row.food_items = foodPayload.map((f, i) => ({
        id: id * 1000 + i,
        log_id: id,
        name: f.name,
        quantity: f.quantity,
        unit: f.unit,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        meal: null,
      }));
      foodMap[String(id)] = row.food_items;
      localStore.setFoodItems(foodMap);
    }
    const next = [row, ...all.filter((x) => x.date !== date)];
    localStore.setDailyLogs(next);
    await load();
    setMsg("Enregistré en local");
  }

  const sorted = useMemo(() => [...logs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [logs]);

  return (
    <div className="space-y-8">
      {deletingLogId != null && (
        <ConfirmDialog
          title="Supprimer cette entrée ?"
          message="Ce journal quotidien et tous ses aliments associés seront supprimés définitivement."
          confirmLabel="Confirmer la suppression"
          danger
          onConfirm={() => void deleteLog(deletingLogId)}
          onCancel={() => setDeletingLogId(null)}
        />
      )}

      <header>
        <h1 className="font-display text-4xl tracking-[0.08em]">Suivi quotidien</h1>
        <p className="text-shred-muted mt-2">Alimentation et poids. Une entrée par jour calendaire.</p>
      </header>

      <section className="rounded-shred border border-shred-border bg-shred-surface p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl tracking-wide">Saisie du jour</h2>
          <div
            className={`text-xs font-mono px-2 py-1 rounded-shred border ${
              proteinOk && !calHigh
                ? "border-shred-accent3 text-shred-accent3"
                : "border-shred-accent2 text-shred-accent2"
            }`}
          >
            Totaux (manuel + aliments) : {Math.round(runningTotals.calories)} kcal · P {Math.round(runningTotals.protein)}{" "}
            g · G {Math.round(runningTotals.carbs)} g · L {Math.round(runningTotals.fat)} g
            {!proteinOk ? " · protéines sous 200 g" : null}
            {calHigh ? " · calories au-dessus de la cible" : null}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="text-xs font-mono text-shred-muted block">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
          <label className="text-xs font-mono text-shred-muted block">
            Poids corporel (kg)
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
          <label className="text-xs font-mono text-shred-muted block">
            Masse grasse % (optionnel)
            <input
              type="number"
              step="0.1"
              value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
          <div className="text-xs font-mono text-shred-muted block">
            Type de jour
            <div className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface px-3 py-2 font-mono text-sm">
              {dayType === "training"
                ? <span style={{ color: "#e8ff3b" }}>Jour d&apos;entraînement</span>
                : <span className="text-shred-muted">Jour de repos</span>}
            </div>
          </div>
          <div className="text-xs font-mono text-shred-muted block">
            Séance faite aujourd&apos;hui
            <div className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface px-3 py-2 font-mono text-sm">
              {todaySummary?.sessions && todaySummary.sessions.length > 0
                ? <span className="text-shred-accent3">✓ {todaySummary.sessions.map((s) => s.name).join(" · ")}</span>
                : <span className="text-shred-muted">Aucune séance aujourd&apos;hui</span>}
            </div>
            {todaySummary?.walk && (
              <div className="mt-1 flex items-center gap-1 rounded-shred border border-shred-accent3/30 bg-shred-accent3/5 px-2 py-0.5 w-fit">
                <span className="text-[11px] font-mono text-shred-accent3">
                  🚶 {todaySummary.walk.duration_minutes} min{todaySummary.walk.distance_km ? ` · ${todaySummary.walk.distance_km} km` : ""}
                </span>
              </div>
            )}
          </div>
          <label className="text-xs font-mono text-shred-muted block">
            Eau (L)
            <input
              type="number"
              step="0.1"
              value={water}
              onChange={(e) => setWater(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
          {/* Macros — auto-fill depuis le journal alimentaire */}
          <div className="sm:col-span-2 lg:col-span-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-shred-muted">Macros</span>
              <div className="flex items-center gap-2">
                {todaySummary?.food_totals && !manualMacros && (
                  <span className="text-shred-accent3 text-[10px] font-mono">• Auto depuis journal</span>
                )}
                <button type="button" onClick={() => setManualMacros((v) => !v)}
                  className="text-[10px] font-mono border border-shred-border rounded px-1.5 py-0.5 text-shred-muted hover:text-shred-text transition-colors">
                  {manualMacros ? "← Auto" : "Modifier"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { label: "Calories (kcal)", val: calories, set: setCalories },
                { label: "Protéines (g)", val: protein, set: setProtein },
                { label: "Glucides (g)", val: carbs, set: setCarbs },
                { label: "Lipides (g)", val: fat, set: setFat },
              ]).map(({ label, val, set }) => (
                <label key={label} className="text-xs font-mono text-shred-muted block">
                  {label}
                  <input type="number" value={val} onChange={(e) => set(e.target.value)}
                    readOnly={!manualMacros && !!todaySummary?.food_totals}
                    className={`mt-1 w-full rounded-shred border border-shred-border px-2 py-1.5 text-sm font-mono ${!manualMacros && todaySummary?.food_totals ? "bg-shred-surface text-shred-muted" : "bg-shred-surface2"}`} />
                </label>
              ))}
            </div>
            {todaySummary?.food_totals?.by_meal && todaySummary.food_totals.by_meal.length > 0 && !manualMacros && (
              <p className="text-[10px] text-shred-muted/50 font-mono">
                {todaySummary.food_totals.by_meal.map((m) => `${MEAL_LABELS[m.meal ?? "meal1"] ?? m.meal}: ${Math.round(m.calories)} kcal`).join(" · ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 pt-5">
            <span className="text-xs font-mono text-shred-muted">Créatine prise</span>
            <button
              type="button"
              onClick={() => setCreatine((c) => !c)}
              className={`rounded-shred border px-4 py-2 font-mono text-sm ${
                creatine ? "border-shred-accent3 bg-shred-accent3/20 text-shred-accent3" : "border-shred-border text-shred-muted"
              }`}
            >
              {creatine ? "Oui" : "Non"}
            </button>
          </div>
          <label className="sm:col-span-2 lg:col-span-3 text-xs font-mono text-shred-muted block">
            Notes
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => setShowFood((s) => !s)}
          className="rounded-shred border border-shred-border px-3 py-2 font-mono text-xs text-shred-muted"
        >
          {showFood ? "Masquer le détail aliments" : "Détail par aliment (optionnel)"}
        </button>

        {showFood ? (
          <div className="space-y-3 border-t border-shred-border pt-4">
            <h3 className="font-display text-lg">Aliments</h3>
            {foods.map((f, idx) => (
              <div key={idx} className="grid md:grid-cols-6 gap-2 items-end">
                <label className="text-xs font-mono text-shred-muted md:col-span-2 block">
                  Nom
                  <input
                    value={f.name}
                    onChange={(e) =>
                      setFoods((arr) => arr.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                    }
                    className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5"
                  />
                </label>
                <label className="text-xs font-mono text-shred-muted block">
                  Qté
                  <input
                    value={f.quantity}
                    onChange={(e) =>
                      setFoods((arr) => arr.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))
                    }
                    className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5"
                  />
                </label>
                <label className="text-xs font-mono text-shred-muted block">
                  Unité
                  <input
                    value={f.unit}
                    onChange={(e) =>
                      setFoods((arr) => arr.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x)))
                    }
                    placeholder="g / ml"
                    className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5"
                  />
                </label>
                <label className="text-xs font-mono text-shred-muted block">
                  kcal
                  <input
                    value={f.calories}
                    onChange={(e) =>
                      setFoods((arr) => arr.map((x, i) => (i === idx ? { ...x, calories: e.target.value } : x)))
                    }
                    className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5"
                  />
                </label>
                <label className="text-xs font-mono text-shred-muted block">
                  P / G / L
                  <div className="mt-1 flex gap-1">
                    <input
                      value={f.protein}
                      onChange={(e) =>
                        setFoods((arr) => arr.map((x, i) => (i === idx ? { ...x, protein: e.target.value } : x)))
                      }
                      className="w-full rounded-shred border border-shred-border bg-shred-bg px-1 py-1.5 text-xs"
                    />
                    <input
                      value={f.carbs}
                      onChange={(e) =>
                        setFoods((arr) => arr.map((x, i) => (i === idx ? { ...x, carbs: e.target.value } : x)))
                      }
                      className="w-full rounded-shred border border-shred-border bg-shred-bg px-1 py-1.5 text-xs"
                    />
                    <input
                      value={f.fat}
                      onChange={(e) =>
                        setFoods((arr) => arr.map((x, i) => (i === idx ? { ...x, fat: e.target.value } : x)))
                      }
                      className="w-full rounded-shred border border-shred-border bg-shred-bg px-1 py-1.5 text-xs"
                    />
                  </div>
                </label>
                <button
                  type="button"
                  onClick={() => setFoods((arr) => arr.filter((_, i) => i !== idx))}
                  className="rounded-shred border border-shred-accent2 text-shred-accent2 px-2 py-1 text-xs h-9 self-end"
                >
                  Retirer
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setFoods((f) => [...f, { name: "", quantity: "", unit: "g", calories: "", protein: "", carbs: "", fat: "" }])
              }
              className="rounded-shred border border-shred-border px-3 py-2 font-mono text-xs"
            >
              + Ligne aliment
            </button>
          </div>
        ) : null}

        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => void saveEntry()}
            className="rounded-shred border border-shred-accent bg-shred-accent px-5 py-2 font-mono text-sm text-shred-bg">
            Enregistrer la journée
          </button>
        </div>
        {msg ? <p className="font-mono text-sm text-shred-accent3">{msg}</p> : null}
      </section>

      <section className="rounded-shred border border-shred-border bg-shred-surface overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-shred-surface2 font-mono text-xs uppercase text-shred-muted">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Poids</th>
              <th className="px-3 py-2">Calories</th>
              <th className="px-3 py-2">Prot.</th>
              <th className="px-3 py-2">Gluc.</th>
              <th className="px-3 py-2">Lip.</th>
              <th className="px-3 py-2">Séance</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((log, idx) => {
              const prev = sorted[idx + 1];
              const down = prev && log.weight != null && prev.weight != null && log.weight < prev.weight;
              const st = statusFor(log);
              const sess = sessions.find((s) => s.id === log.session_id);
              return (
                <tr
                  key={log.id}
                  className={`border-t border-shred-border ${down ? "bg-shred-accent3/5" : ""}`}
                >
                  <td className="px-3 py-2 font-mono text-shred-text">{log.date}</td>
                  <td className="px-3 py-2 font-mono">{log.weight ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{log.calories ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{log.protein ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{log.carbs ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{log.fat ?? "—"}</td>
                  <td className="px-3 py-2 text-shred-muted">{sess?.name ?? "—"}</td>
                  <td className={`px-3 py-2 font-mono ${st.ok ? "text-shred-accent3" : "text-shred-accent2"}`}>
                    {st.label}
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => setDeletingLogId(log.id)}
                      className="text-shred-muted/30 hover:text-red-400 transition-colors font-mono text-sm"
                      title="Supprimer cette entrée"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
