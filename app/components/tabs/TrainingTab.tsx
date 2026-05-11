"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { SESSION_TYPES, WEEKLY_SPLIT } from "@/lib/constants";
import type { ExerciseRow, FastWalkRow, SessionRow, WorkoutLogRow } from "@/lib/types";
import { isoWeekKey } from "@/lib/dates";
import { localStore, nextLocalId } from "@/lib/localStore";

type SessionWithEx = SessionRow & { exercises: ExerciseRow[] };

function parseRepsList(raw: string, setCount: number): string[] {
  const parts = raw
    .split(/[,;/\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < setCount; i++) {
    out.push(parts[i] ?? parts[parts.length - 1] ?? "0");
  }
  return out;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; useLocal?: boolean; data?: T }> {
  const res = await fetch(url, init);
  const j = (await res.json()) as { ok?: boolean; useLocal?: boolean; data?: T };
  if (res.status === 503 && j?.useLocal) return { ok: false, useLocal: true };
  if (!res.ok || !j.ok) return { ok: false };
  return { ok: true, data: j.data as T };
}

export function TrainingTab() {
  const [sessions, setSessions] = useState<SessionWithEx[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [walks, setWalks] = useState<FastWalkRow[]>([]);
  const [useLocal, setUseLocal] = useState(false);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<string>("PUSH");
  const [newDate, setNewDate] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [editId, setEditId] = useState<number | null>(null);
  const [draftEx, setDraftEx] = useState<Partial<ExerciseRow>[]>([]);

  const [logSessionId, setLogSessionId] = useState<number | "">("");
  const [logDate, setLogDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [logFields, setLogFields] = useState<
    Record<number, { weight: string; reps: string; rpe: string; notes: string }>
  >({});

  const [walkDur, setWalkDur] = useState("25");
  const [walkKm, setWalkKm] = useState("");
  const [walkNotes, setWalkNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const sRes = await fetch("/api/sessions");
    const sJ = await sRes.json();
    if (sRes.ok && sJ.ok) {
      setSessions(sJ.data as SessionWithEx[]);
      setUseLocal(false);
    } else {
      setUseLocal(true);
      setSessions((localStore.getSessions() as SessionWithEx[]) ?? []);
    }
    const nRes = await fetchJson<string[]>("/api/exercises?names=1");
    if (nRes.ok && nRes.data) setNames(nRes.data);
    else {
      const allEx = localStore.getExercises();
      const set = new Set<string>();
      Object.values(allEx).forEach((arr) => {
        (arr as { name?: string }[]).forEach((e) => {
          if (e.name) set.add(e.name);
        });
      });
      setNames([...set].sort((a, b) => a.localeCompare(b)));
    }
    const wRes = await fetch("/api/walks");
    const wJ = await wRes.json();
    if (wRes.ok && wJ.ok) setWalks(wJ.data as FastWalkRow[]);
    else setWalks((localStore.getWalks() as FastWalkRow[]) ?? []);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === logSessionId),
    [sessions, logSessionId],
  );

  const weekWalkLabel = useMemo(() => {
    const wk = isoWeekKey(new Date());
    const inWeek = walks.filter((w) => isoWeekKey(new Date(w.date + "T12:00:00")) === wk);
    return { done: inWeek.length, wk };
  }, [walks]);

  function persistLocalSessions(next: SessionWithEx[]) {
    setSessions(next);
    localStore.setSessions(next);
    const map = localStore.getExercises();
    next.forEach((s) => {
      map[String(s.id)] = s.exercises;
    });
    localStore.setExercises(map);
  }

  async function createSession(asTemplate: boolean) {
    setMsg(null);
    if (!newName.trim()) {
      setMsg("Session name required");
      return;
    }
    const body = {
      name: newName.trim(),
      type: newType,
      date: newDate || null,
      template: asTemplate ? 1 : 0,
      notes: newNotes || null,
      exercises: [],
    };
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (res.ok && j.ok) {
      setSessions((prev) => [j.data as SessionWithEx, ...prev]);
      setNewName("");
      setNewDate("");
      setNewNotes("");
      setMsg("Session created");
      return;
    }
    const id = nextLocalId(sessions);
    const row: SessionWithEx = {
      id,
      name: body.name,
      type: body.type,
      date: body.date,
      template: asTemplate ? 1 : 0,
      notes: body.notes,
      exercises: [],
    };
    persistLocalSessions([row, ...sessions]);
    setNewName("");
    setNewDate("");
    setNewNotes("");
    setMsg("Saved locally (database offline)");
  }

  function beginEdit(s: SessionWithEx) {
    setEditId(s.id);
    setDraftEx(s.exercises.map((e) => ({ ...e })));
  }

  function cancelEdit() {
    setEditId(null);
    setDraftEx([]);
  }

  async function saveEdit() {
    if (editId == null) return;
    const base = sessions.find((s) => s.id === editId);
    if (!base) return;
    const exercises = draftEx.map((e, i) => ({
      name: (e.name ?? "").trim(),
      sets: Number(e.sets) || 3,
      reps_target: e.reps_target ?? "8-10",
      rest_seconds: Number(e.rest_seconds) || 90,
      order_index: i,
      notes: e.notes ?? null,
    })).filter((e) => e.name.length > 0);

    const res = await fetch("/api/sessions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editId,
        name: base.name,
        type: base.type,
        date: base.date,
        template: base.template,
        notes: base.notes,
        exercises,
      }),
    });
    const j = await res.json();
    if (res.ok && j.ok) {
      setSessions((prev) => prev.map((s) => (s.id === editId ? (j.data as SessionWithEx) : s)));
      setMsg("Session saved");
      cancelEdit();
      return;
    }
    const next = sessions.map((s) => {
      if (s.id !== editId) return s;
      return {
        ...s,
        exercises: exercises.map((ex, idx) => ({
          id: nextLocalId(s.exercises) + idx,
          session_id: editId,
          name: ex.name,
          sets: ex.sets,
          reps_target: ex.reps_target,
          rest_seconds: ex.rest_seconds,
          order_index: idx,
          notes: ex.notes,
        })),
      };
    });
    persistLocalSessions(next);
    setMsg("Saved locally");
    cancelEdit();
  }

  function addExerciseRow() {
    setDraftEx((d) => [
      ...d,
      { name: "", sets: 3, reps_target: "8-10", rest_seconds: 90, notes: "", order_index: d.length },
    ]);
  }

  function moveEx(i: number, dir: -1 | 1) {
    setDraftEx((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const c = [...d];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  }

  function removeEx(i: number) {
    setDraftEx((d) => d.filter((_, idx) => idx !== i));
  }

  async function markAsTemplate(s: SessionWithEx) {
    const exercises = s.exercises.map((e, i) => ({
      name: e.name,
      sets: e.sets,
      reps_target: e.reps_target,
      rest_seconds: e.rest_seconds,
      order_index: i,
      notes: e.notes,
    }));
    const res = await fetch("/api/sessions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: s.id,
        name: s.name,
        type: s.type,
        date: s.date,
        template: 1,
        notes: s.notes,
        exercises,
      }),
    });
    const j = await res.json();
    if (res.ok && j.ok) {
      setSessions((prev) => prev.map((x) => (x.id === s.id ? (j.data as SessionWithEx) : x)));
      setMsg("Saved as template");
      return;
    }
    const next = sessions.map((x) => (x.id === s.id ? { ...x, template: 1 } : x));
    persistLocalSessions(next);
    setMsg("Template flag saved locally");
  }

  async function deleteSession(id: number) {
    if (!confirm("Delete this session and its exercises?")) return;
    const res = await fetch(`/api/sessions?id=${id}`, { method: "DELETE" });
    const j = await res.json();
    if (res.ok && j.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      return;
    }
    persistLocalSessions(sessions.filter((s) => s.id !== id));
  }

  async function loadPrevWeights() {
    if (!selectedSession) return;
    const next: typeof logFields = { ...logFields };
    for (const ex of selectedSession.exercises) {
      const r = await fetchJson<WorkoutLogRow[]>(
        `/api/workout-logs?exercise=${encodeURIComponent(ex.name)}&type=${encodeURIComponent(selectedSession.type)}`,
      );
      let rows = r.data ?? [];
      if (!r.ok) {
        const all = (localStore.getWorkoutLogs() as WorkoutLogRow[]).filter(
          (w) => w.exercise_name === ex.name,
        );
        const sType = selectedSession.type;
        rows = all.filter((w) => {
          const sid = sessions.find((s) => s.id === w.session_id);
          return sid?.type === sType;
        });
      }
      const byDate = new Map<string, WorkoutLogRow[]>();
      rows.forEach((row) => {
        const arr = byDate.get(row.date) ?? [];
        arr.push(row);
        byDate.set(row.date, arr);
      });
      const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
      const prevDate = dates.find((d) => d !== logDate);
      if (!prevDate) {
        /* skip — no prior session */
      } else {
        const prevRows = byDate.get(prevDate)!.filter((x) => x.exercise_name === ex.name);
        const maxW = Math.max(...prevRows.map((x) => x.weight_kg), 0);
        next[ex.id] = {
          weight: maxW ? String(maxW) : "",
          reps: next[ex.id]?.reps ?? "",
          rpe: next[ex.id]?.rpe ?? "",
          notes: next[ex.id]?.notes ?? "",
        };
      }
    }
    setLogFields(next);
  }

  useEffect(() => {
    if (!selectedSession) {
      setLogFields({});
      return;
    }
    const init: typeof logFields = {};
    selectedSession.exercises.forEach((ex) => {
      init[ex.id] = logFields[ex.id] ?? { weight: "", reps: "", rpe: "", notes: "" };
    });
    setLogFields(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when session changes
  }, [logSessionId, selectedSession?.id]);

  async function compareNote(ex: ExerciseRow, weight: number): Promise<string> {
    if (!selectedSession) return "";
    const r = await fetchJson<WorkoutLogRow[]>(
      `/api/workout-logs?exercise=${encodeURIComponent(ex.name)}&type=${encodeURIComponent(selectedSession.type)}`,
    );
    let rows = r.data ?? [];
    if (!r.ok) {
      rows = (localStore.getWorkoutLogs() as WorkoutLogRow[]).filter((w) => {
        if (w.exercise_name !== ex.name) return false;
        const sid = sessions.find((s) => s.id === w.session_id);
        return sid?.type === selectedSession.type;
      });
    }
    const byDate = new Map<string, WorkoutLogRow[]>();
    rows.forEach((row) => {
      const arr = byDate.get(row.date) ?? [];
      arr.push(row);
      byDate.set(row.date, arr);
    });
    const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    const prevDate = dates.find((d) => d !== logDate);
    if (!prevDate) return "First log for this lift pattern";
    const prevMax = Math.max(
      ...byDate.get(prevDate)!.filter((x) => x.exercise_name === ex.name).map((x) => x.weight_kg),
      0,
    );
    if (!prevMax) return "No prior weight";
    const diff = Math.round((weight - prevMax) * 10) / 10;
    if (diff > 0) return `↑ +${diff}kg vs last session`;
    if (diff < 0) return "↓ Reduced weight vs last session";
    return "= Same weight";
  }

  async function submitWorkout() {
    setMsg(null);
    if (!selectedSession || logSessionId === "") {
      setMsg("Pick a session");
      return;
    }
    const rows: {
      exercise_name: string;
      set_number: number;
      weight_kg: number;
      reps_done: string;
      rpe: number | null;
      notes: string | null;
    }[] = [];
    for (const ex of selectedSession.exercises) {
      const f = logFields[ex.id];
      const w = Number(f?.weight);
      if (!f || Number.isNaN(w)) {
        setMsg(`Weight required for ${ex.name}`);
        return;
      }
      const repsList = parseRepsList(f.reps || "0", ex.sets);
      const rpeVal = f.rpe ? Number(f.rpe) : null;
      for (let i = 0; i < ex.sets; i++) {
        rows.push({
          exercise_name: ex.name,
          set_number: i + 1,
          weight_kg: w,
          reps_done: repsList[i] ?? "0",
          rpe: rpeVal,
          notes: f.notes || null,
        });
      }
    }
    const res = await fetch("/api/workout-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: logSessionId, date: logDate, rows }),
    });
    const j = await res.json();
    if (res.ok && j.ok) {
      setMsg("Workout logged");
      return;
    }
    const existing = (localStore.getWorkoutLogs() as WorkoutLogRow[]).filter(
      (x) => !(x.session_id === logSessionId && x.date === logDate),
    );
    const stamped = rows.map((row, idx) => ({
      id: nextLocalId(existing) + idx,
      session_id: logSessionId as number,
      date: logDate,
      ...row,
    }));
    localStore.setWorkoutLogs([...stamped, ...existing]);
    setMsg("Workout saved locally");
  }

  async function submitWalk() {
    if (logSessionId === "") {
      setMsg("Pick a session for the walk link");
      return;
    }
    const dur = Number(walkDur);
    if (Number.isNaN(dur) || dur <= 0) {
      setMsg("Walk duration invalid");
      return;
    }
    const res = await fetch("/api/walks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: logSessionId,
        date: logDate,
        duration_minutes: dur,
        distance_km: walkKm ? Number(walkKm) : null,
        notes: walkNotes || null,
      }),
    });
    const j = await res.json();
    if (res.ok && j.ok) {
      setWalks((w) => [j.data as FastWalkRow, ...w]);
      setMsg("Fast walk logged");
      return;
    }
    const all = localStore.getWalks() as FastWalkRow[];
    const row: FastWalkRow = {
      id: nextLocalId(all),
      session_id: logSessionId as number,
      date: logDate,
      duration_minutes: dur,
      distance_km: walkKm ? Number(walkKm) : null,
      notes: walkNotes || null,
    };
    localStore.setWalks([row, ...all]);
    setWalks((w) => [row, ...w]);
    setMsg("Walk saved locally");
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-display text-4xl tracking-[0.08em]">Training</h1>
        <p className="text-shred-muted mt-2">
          Weekly split · custom sessions · progressive overload · post-workout walks
          {useLocal ? (
            <span className="ml-2 text-shred-accent font-mono text-xs">LOCAL MODE</span>
          ) : null}
        </p>
      </header>

      <section>
        <h2 className="font-display text-2xl tracking-wide mb-3">Weekly split</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {WEEKLY_SPLIT.map((d) => (
            <div
              key={d.day}
              className="rounded-shred border border-shred-border bg-shred-surface p-3 border-t-4 border-t-shred-accent3"
            >
              <p className="font-mono text-xs text-shred-muted">{d.day}</p>
              <p className="font-display text-xl mt-1">{d.label}</p>
              <p className="text-xs text-shred-muted mt-1">{d.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-shred border border-shred-border bg-shred-surface p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-display text-2xl tracking-wide">Custom sessions</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block text-xs font-mono text-shred-muted">
            Session name
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-shred-text"
            />
          </label>
          <label className="block text-xs font-mono text-shred-muted">
            Type
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-shred-text"
            >
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-mono text-shred-muted">
            Day / date note
            <input
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              placeholder="e.g. Monday or 2026-05-12"
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-shred-text"
            />
          </label>
          <label className="block text-xs font-mono text-shred-muted">
            Notes
            <input
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-shred-text"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void createSession(false)}
            className="rounded-shred border border-shred-accent bg-shred-accent px-4 py-2 font-mono text-sm text-shred-bg"
          >
            + New session
          </button>
          <button
            type="button"
            onClick={() => void createSession(true)}
            className="rounded-shred border border-shred-border bg-shred-surface2 px-4 py-2 font-mono text-sm text-shred-text"
          >
            + New template
          </button>
        </div>

        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-shred border border-shred-border bg-shred-surface2 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display text-2xl tracking-wide">{s.name}</p>
                  <p className="font-mono text-xs text-shred-muted mt-1">
                    {s.type}
                    {s.date ? ` · ${s.date}` : ""}
                    {s.template ? " · TEMPLATE" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => beginEdit(s)}
                    className="rounded-shred border border-shred-border px-3 py-1 text-xs font-mono text-shred-text"
                  >
                    Edit exercises
                  </button>
                  <button
                    type="button"
                    onClick={() => void markAsTemplate(s)}
                    className="rounded-shred border border-shred-accent px-3 py-1 text-xs font-mono text-shred-accent"
                  >
                    Save as template
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteSession(s.id)}
                    className="rounded-shred border border-shred-accent2 px-3 py-1 text-xs font-mono text-shred-accent2"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {s.exercises.length ? (
                <ul className="mt-2 text-sm text-shred-muted list-disc pl-5 space-y-1">
                  {s.exercises.map((e) => (
                    <li key={e.id}>
                      {e.name} — {e.sets}×{e.reps_target} · {e.rest_seconds}s rest
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-shred-muted mt-2">No exercises yet — edit to add.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {editId != null ? (
        <section className="rounded-shred border border-shred-accent3 border-t-4 border-t-shred-accent3 bg-shred-surface p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-xl">Edit exercises</h3>
            <button type="button" onClick={cancelEdit} className="font-mono text-xs text-shred-muted">
              Close
            </button>
          </div>
          {draftEx.map((ex, i) => (
            <div key={i} className="grid lg:grid-cols-12 gap-2 items-end border-b border-shred-border pb-3">
              <label className="lg:col-span-3 text-xs font-mono text-shred-muted block">
                Name
                <input
                  list="ex-names"
                  value={ex.name ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraftEx((d) => d.map((x, idx) => (idx === i ? { ...x, name: v } : x)));
                  }}
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm"
                />
              </label>
              <label className="lg:col-span-1 text-xs font-mono text-shred-muted block">
                Sets
                <input
                  type="number"
                  value={ex.sets ?? 3}
                  onChange={(e) =>
                    setDraftEx((d) => d.map((x, idx) => (idx === i ? { ...x, sets: Number(e.target.value) } : x)))
                  }
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm"
                />
              </label>
              <label className="lg:col-span-2 text-xs font-mono text-shred-muted block">
                Reps target
                <input
                  value={ex.reps_target ?? ""}
                  onChange={(e) =>
                    setDraftEx((d) => d.map((x, idx) => (idx === i ? { ...x, reps_target: e.target.value } : x)))
                  }
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm"
                />
              </label>
              <label className="lg:col-span-2 text-xs font-mono text-shred-muted block">
                Rest (s)
                <input
                  type="number"
                  value={ex.rest_seconds ?? 90}
                  onChange={(e) =>
                    setDraftEx((d) =>
                      d.map((x, idx) => (idx === i ? { ...x, rest_seconds: Number(e.target.value) } : x)),
                    )
                  }
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm"
                />
              </label>
              <label className="lg:col-span-3 text-xs font-mono text-shred-muted block">
                Notes
                <input
                  value={ex.notes ?? ""}
                  onChange={(e) =>
                    setDraftEx((d) => d.map((x, idx) => (idx === i ? { ...x, notes: e.target.value } : x)))
                  }
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm"
                />
              </label>
              <div className="lg:col-span-1 flex gap-1">
                <button type="button" onClick={() => moveEx(i, -1)} className="rounded-shred border border-shred-border px-2 py-1 text-xs">
                  ↑
                </button>
                <button type="button" onClick={() => moveEx(i, 1)} className="rounded-shred border border-shred-border px-2 py-1 text-xs">
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeEx(i)}
                  className="rounded-shred border border-shred-accent2 px-2 py-1 text-xs text-shred-accent2"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <datalist id="ex-names">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addExerciseRow}
              className="rounded-shred border border-shred-border px-3 py-2 font-mono text-xs"
            >
              + Exercise
            </button>
            <button
              type="button"
              onClick={() => void saveEdit()}
              className="rounded-shred border border-shred-accent bg-shred-accent px-4 py-2 font-mono text-sm text-shred-bg"
            >
              Save session
            </button>
          </div>
        </section>
      ) : null}

      <section className="rounded-shred border border-shred-border bg-shred-surface p-4 space-y-4">
        <h2 className="font-display text-2xl tracking-wide">Post-workout logging</h2>
        <p className="text-sm text-shred-muted">
          Progressive overload rule: if all reps completed with good form → add 1.25kg or +1 rep next session.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-xs font-mono text-shred-muted block">
            Session
            <select
              value={logSessionId === "" ? "" : String(logSessionId)}
              onChange={(e) => setLogSessionId(e.target.value ? Number(e.target.value) : "")}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            >
              <option value="">Select…</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.type})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-mono text-shred-muted block">
            Date
            <input
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void loadPrevWeights()}
              className="w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 font-mono text-xs"
            >
              Prefill weights from last same-type session
            </button>
          </div>
        </div>
        {selectedSession && selectedSession.exercises.length ? (
          <div className="space-y-4">
            {selectedSession.exercises.map((ex) => (
              <ExerciseLogRow
                key={ex.id}
                ex={ex}
                value={logFields[ex.id]}
                onChange={(next) => setLogFields((f) => ({ ...f, [ex.id]: next }))}
                compare={compareNote}
              />
            ))}
            <button
              type="button"
              onClick={() => void submitWorkout()}
              className="rounded-shred border border-shred-accent3 bg-shred-accent3/20 px-4 py-2 font-mono text-sm text-shred-accent3 border-shred-accent3"
            >
              Save workout performance
            </button>
          </div>
        ) : (
          <p className="text-sm text-shred-muted">Select a session with exercises to log.</p>
        )}
      </section>

      <section className="rounded-shred border border-shred-border bg-shred-surface p-4 space-y-3">
        <h2 className="font-display text-2xl tracking-wide">Post-workout fast walk</h2>
        <p className="text-sm text-shred-muted">Suggested 20–30 minutes. Links to the same session + date.</p>
        <div className="grid sm:grid-cols-4 gap-3">
          <label className="text-xs font-mono text-shred-muted block">
            Duration (min)
            <input
              type="number"
              value={walkDur}
              onChange={(e) => setWalkDur(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
          <label className="text-xs font-mono text-shred-muted block">
            Distance (km, optional)
            <input
              type="number"
              value={walkKm}
              onChange={(e) => setWalkKm(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
          <label className="text-xs font-mono text-shred-muted sm:col-span-2 block">
            Notes
            <input
              value={walkNotes}
              onChange={(e) => setWalkNotes(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void submitWalk()}
          className="rounded-shred border border-shred-border bg-shred-surface2 px-4 py-2 font-mono text-sm"
        >
          Log fast walk
        </button>
        <p className="font-mono text-sm text-shred-accent3">
          🚶 Weekly walks ({weekWalkLabel.wk}): {weekWalkLabel.done}/5 target sessions — count is walks logged this ISO
          week.
        </p>
        {selectedSession ? (
          <p className="text-xs text-shred-muted">
            Session summary line:{" "}
            <span className="text-shred-text">
              🚶 Fast walk: {walkDur || "?"} min post-workout ({selectedSession.name})
            </span>
          </p>
        ) : null}
      </section>

      {msg ? <p className="font-mono text-sm text-shred-accent">{msg}</p> : null}
    </div>
  );
}

function ExerciseLogRow({
  ex,
  value,
  onChange,
  compare,
}: {
  ex: ExerciseRow;
  value?: { weight: string; reps: string; rpe: string; notes: string };
  onChange: (v: { weight: string; reps: string; rpe: string; notes: string }) => void;
  compare: (ex: ExerciseRow, w: number) => Promise<string>;
}) {
  const [hint, setHint] = useState<string>("");
  const v = value ?? { weight: "", reps: "", rpe: "", notes: "" };

  return (
    <div className="rounded-shred border border-shred-border bg-shred-surface2 p-3 space-y-2">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-display text-lg">{ex.name}</p>
        <p className="text-xs font-mono text-shred-muted">
          Target {ex.sets} sets · {ex.reps_target} reps
        </p>
      </div>
      <div className="grid sm:grid-cols-4 gap-2">
        <label className="text-xs font-mono text-shred-muted block">
          Weight (kg)
          <input
            type="number"
            value={v.weight}
            onChange={(e) => onChange({ ...v, weight: e.target.value })}
            onBlur={async (e) => {
              const w = Number(e.currentTarget.value);
              if (!Number.isNaN(w) && w > 0) setHint(await compare(ex, w));
              else setHint("");
            }}
            className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5"
          />
        </label>
        <label className="text-xs font-mono text-shred-muted block sm:col-span-2">
          Reps per set (comma-separated)
          <input
            value={v.reps}
            onChange={(e) => onChange({ ...v, reps: e.target.value })}
            placeholder="e.g. 8, 8, 7"
            className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5"
          />
        </label>
        <label className="text-xs font-mono text-shred-muted block">
          RPE 1–10
          <input
            type="number"
            value={v.rpe}
            onChange={(e) => onChange({ ...v, rpe: e.target.value })}
            className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5"
          />
        </label>
      </div>
      <label className="text-xs font-mono text-shred-muted block">
        Notes
        <input
          value={v.notes}
          onChange={(e) => onChange({ ...v, notes: e.target.value })}
          className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5"
        />
      </label>
      {hint ? (
        <p
          className={`text-xs font-mono ${
            hint.startsWith("↑")
              ? "text-shred-accent3"
              : hint.startsWith("↓")
                ? "text-shred-accent2"
                : hint.startsWith("=")
                  ? "text-shred-accent"
                  : "text-shred-muted"
          }`}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
