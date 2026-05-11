"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { MACRO_REST, MACRO_TRAINING, PROTEIN_OK_THRESHOLD } from "@/lib/constants";
import type { DailyLog, FoodItem, SessionRow } from "@/lib/types";
import { localStore, nextLocalId } from "@/lib/localStore";

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
  return ok ? { label: "✓ OK", ok: true } : { label: "⚠ Review", ok: false };
}

export function TrackingTab() {
  const [logs, setLogs] = useState<LogWithFood[]>([]);
  const [sessions, setSessions] = useState<SessionWithEx[]>([]);
  const [showFood, setShowFood] = useState(false);

  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [weight, setWeight] = useState("106.6");
  const [bodyFat, setBodyFat] = useState("18");
  const [dayType, setDayType] = useState<"training" | "rest">("training");
  const [sessionId, setSessionId] = useState<number | "">("");
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
      session_id: sessionId === "" ? null : sessionId,
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
      setMsg("Saved");
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
      }));
      foodMap[String(id)] = row.food_items;
      localStore.setFoodItems(foodMap);
    }
    const next = [row, ...all.filter((x) => x.date !== date)];
    localStore.setDailyLogs(next);
    await load();
    setMsg("Saved locally");
  }

  const sorted = useMemo(() => [...logs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [logs]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl tracking-[0.08em]">Daily tracking</h1>
        <p className="text-shred-muted mt-2">Food + weight log. One entry per calendar day.</p>
      </header>

      <section className="rounded-shred border border-shred-border bg-shred-surface p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl tracking-wide">Daily entry</h2>
          <div
            className={`text-xs font-mono px-2 py-1 rounded-shred border ${
              proteinOk && !calHigh
                ? "border-shred-accent3 text-shred-accent3"
                : "border-shred-accent2 text-shred-accent2"
            }`}
          >
            Totals (manual + foods): {Math.round(runningTotals.calories)} kcal · P {Math.round(runningTotals.protein)}g
            · C {Math.round(runningTotals.carbs)}g · F {Math.round(runningTotals.fat)}g
            {!proteinOk ? " · protein under 200g" : null}
            {calHigh ? " · calories over target" : null}
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
            Body weight (kg)
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
          <label className="text-xs font-mono text-shred-muted block">
            Body fat % (optional)
            <input
              type="number"
              step="0.1"
              value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
          <label className="text-xs font-mono text-shred-muted block">
            Day type
            <select
              value={dayType}
              onChange={(e) => setDayType(e.target.value as "training" | "rest")}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            >
              <option value="training">Training day</option>
              <option value="rest">Rest day</option>
            </select>
          </label>
          <label className="text-xs font-mono text-shred-muted block">
            Session done today
            <select
              value={sessionId === "" ? "" : String(sessionId)}
              onChange={(e) => setSessionId(e.target.value ? Number(e.target.value) : "")}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            >
              <option value="">None</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-mono text-shred-muted block">
            Water (L)
            <input
              type="number"
              step="0.1"
              value={water}
              onChange={(e) => setWater(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
          <label className="text-xs font-mono text-shred-muted block">
            Calories consumed
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
          <label className="text-xs font-mono text-shred-muted block">
            Protein (g)
            <input
              type="number"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
          <label className="text-xs font-mono text-shred-muted block">
            Carbs (g)
            <input
              type="number"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
          <label className="text-xs font-mono text-shred-muted block">
            Fat (g)
            <input
              type="number"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
          <div className="flex items-center gap-3 pt-5">
            <span className="text-xs font-mono text-shred-muted">Creatine taken</span>
            <button
              type="button"
              onClick={() => setCreatine((c) => !c)}
              className={`rounded-shred border px-4 py-2 font-mono text-sm ${
                creatine ? "border-shred-accent3 bg-shred-accent3/20 text-shred-accent3" : "border-shred-border text-shred-muted"
              }`}
            >
              {creatine ? "Yes" : "No"}
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
          {showFood ? "Hide food detail" : "Food detail tracker (optional)"}
        </button>

        {showFood ? (
          <div className="space-y-3 border-t border-shred-border pt-4">
            <h3 className="font-display text-lg">Food items</h3>
            {foods.map((f, idx) => (
              <div key={idx} className="grid md:grid-cols-6 gap-2 items-end">
                <label className="text-xs font-mono text-shred-muted md:col-span-2 block">
                  Name
                  <input
                    value={f.name}
                    onChange={(e) =>
                      setFoods((arr) => arr.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                    }
                    className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5"
                  />
                </label>
                <label className="text-xs font-mono text-shred-muted block">
                  Qty
                  <input
                    value={f.quantity}
                    onChange={(e) =>
                      setFoods((arr) => arr.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))
                    }
                    className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5"
                  />
                </label>
                <label className="text-xs font-mono text-shred-muted block">
                  Unit
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
                  P / C / F
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
                  Remove
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
              + Food row
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void saveEntry()}
          className="rounded-shred border border-shred-accent bg-shred-accent px-5 py-2 font-mono text-sm text-shred-bg"
        >
          Save daily log
        </button>
        {msg ? <p className="font-mono text-sm text-shred-accent3">{msg}</p> : null}
      </section>

      <section className="rounded-shred border border-shred-border bg-shred-surface overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-shred-surface2 font-mono text-xs uppercase text-shred-muted">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Weight</th>
              <th className="px-3 py-2">Calories</th>
              <th className="px-3 py-2">Protein</th>
              <th className="px-3 py-2">Carbs</th>
              <th className="px-3 py-2">Fat</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Status</th>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
