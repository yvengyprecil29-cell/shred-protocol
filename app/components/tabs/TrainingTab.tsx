"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { SESSION_TYPE_LABELS, SESSION_TYPES, WEEKLY_SPLIT } from "@/lib/constants";
import type { ExerciseRow, FastWalkRow, SessionRow, WorkoutLogRow } from "@/lib/types";
import { isoWeekKey } from "@/lib/dates";
import { localStore, nextLocalId } from "@/lib/localStore";
import { EXERCISE_LIBRARY, MUSCLE_COLORS, type ExerciseTemplate } from "@/lib/exercise-library";

type SessionWithEx = SessionRow & { exercises: ExerciseRow[] };
type SetLog = { weight: string; reps: string; rpe: string };
type ExLog = { sets: SetLog[]; notes: string };
type LogFields = Record<number, ExLog>;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data?: T }> {
  const res = await fetch(url, init);
  const j = (await res.json()) as { ok?: boolean; data?: T };
  if (!res.ok || !j.ok) return { ok: false };
  return { ok: true, data: j.data as T };
}

function emptySet(): SetLog { return { weight: "", reps: "", rpe: "" }; }

function initSets(ex: ExerciseRow, prevRows?: WorkoutLogRow[]): SetLog[] {
  if (prevRows && prevRows.length > 0) {
    const sorted = [...prevRows].sort((a, b) => a.set_number - b.set_number);
    const sets = sorted.map((r) => ({ weight: String(r.weight_kg), reps: r.reps_done, rpe: r.rpe ? String(r.rpe) : "" }));
    while (sets.length < ex.sets) sets.push({ ...sets[sets.length - 1] });
    return sets.slice(0, ex.sets);
  }
  return Array.from({ length: ex.sets }, emptySet);
}

// ─── Exercise Library Picker ─────────────────────────────────────────────────

function ExercisePicker({ sessionType, onPick, onClose }: { sessionType: string; onPick: (t: ExerciseTemplate) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const lib = EXERCISE_LIBRARY[sessionType as keyof typeof EXERCISE_LIBRARY] ?? [];
  const filtered = lib.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()) || e.muscle.toLowerCase().includes(search.toLowerCase()));
  const byMuscle = filtered.reduce<Record<string, ExerciseTemplate[]>>((acc, e) => { (acc[e.muscle] = acc[e.muscle] ?? []).push(e); return acc; }, {});

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-2" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-shred border border-shred-border bg-shred-bg p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl tracking-wide">Bibliothèque d&apos;exercices</h3>
          <button type="button" onClick={onClose} className="font-mono text-shred-muted text-xl leading-none">✕</button>
        </div>
        <input autoFocus placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-sm" />
        {Object.entries(byMuscle).map(([muscle, exercises]) => (
          <div key={muscle}>
            <p className="font-mono text-xs text-shred-muted uppercase tracking-wider mb-2">{muscle}</p>
            <div className="space-y-2">
              {exercises.map((e) => (
                <button key={e.name} type="button" onClick={() => { onPick(e); onClose(); }}
                  className={`w-full text-left rounded-shred border border-shred-border bg-shred-surface p-3 border-t-4 ${MUSCLE_COLORS[e.muscle]} hover:border-shred-accent transition-colors`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{e.icon}</span>
                    <div>
                      <p className="font-mono text-sm text-shred-text">{e.name}</p>
                      <p className="text-xs text-shred-muted">{e.sets} séries · {e.repRange} reps · {e.rest}s repos</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
        {lib.length === 0 && <p className="text-sm text-shred-muted">Pas de bibliothèque pour ce type — ajoute manuellement.</p>}
      </div>
    </div>
  );
}

// ─── Per-set logging row ──────────────────────────────────────────────────────

function ExerciseLogRow({ ex, value, onChange, prevRows }: { ex: ExerciseRow; value: ExLog; onChange: (v: ExLog) => void; prevRows: WorkoutLogRow[] }) {
  const prevBySet = useMemo(() => {
    const m: Record<number, WorkoutLogRow> = {};
    prevRows.forEach((r) => { m[r.set_number] = r; });
    return m;
  }, [prevRows]);

  const totalVol = value.sets.reduce((s, r) => s + (Number(r.weight) || 0) * (Number(r.reps) || 0), 0);
  const prevVol = prevRows.reduce((s, r) => s + r.weight_kg * (Number(r.reps_done) || 0), 0);
  const diff = prevVol > 0 ? Math.round(((totalVol - prevVol) / prevVol) * 100) : null;

  const [repLow, repHigh] = useMemo(() => {
    const m = ex.reps_target.match(/(\d+)[^\d]*(\d+)?/);
    return m ? [Number(m[1]), Number(m[2] ?? m[1])] : [8, 12];
  }, [ex.reps_target]);

  const allAtTop = prevRows.length > 0 && prevRows.every((r) => Number(r.reps_done) >= repHigh);
  const maxPrevWeight = prevRows.length > 0 ? Math.max(...prevRows.map((r) => r.weight_kg)) : 0;
  const suggestion = allAtTop
    ? `🎉 Surcharge ! Passe à ${(maxPrevWeight + 2.5).toFixed(1)} kg la prochaine fois`
    : prevRows.length > 0
    ? `🎯 Continue à ${maxPrevWeight} kg — vise ${repHigh} reps sur toutes les séries`
    : null;

  function updateSet(i: number, patch: Partial<SetLog>) {
    onChange({ ...value, sets: value.sets.map((s, idx) => idx === i ? { ...s, ...patch } : s) });
  }

  return (
    <div className="rounded-shred border border-shred-border bg-shred-surface2 p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg">{ex.name}</p>
          <p className="text-xs font-mono text-shred-muted">Cible : {ex.sets} séries · {ex.reps_target} reps · {ex.rest_seconds}s repos</p>
        </div>
        {diff !== null && (
          <span className={`font-mono text-xs px-2 py-1 rounded-shred border ${diff > 0 ? "border-green-500 text-green-400 bg-green-500/10" : diff < 0 ? "border-red-500 text-red-400 bg-red-500/10" : "border-shred-border text-shred-muted"}`}>
            {diff > 0 ? `↑ +${diff}%` : diff < 0 ? `↓ ${diff}%` : "= même volume"}
          </span>
        )}
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm min-w-[320px]">
          <thead>
            <tr className="font-mono text-xs text-shred-muted">
              <th className="text-left py-1 px-1 w-10">Série</th>
              <th className="text-left py-1 px-1">Charge (kg)</th>
              <th className="text-left py-1 px-1">Reps</th>
              <th className="text-left py-1 px-1 hidden sm:table-cell">RPE</th>
              <th className="text-left py-1 px-1 text-shred-muted/50 hidden sm:table-cell">Semaine passée</th>
            </tr>
          </thead>
          <tbody>
            {value.sets.map((s, i) => {
              const prev = prevBySet[i + 1];
              return (
                <tr key={i} className="border-t border-shred-border/40">
                  <td className="py-2 px-1 font-mono text-shred-muted text-xs font-bold">{i + 1}</td>
                  <td className="py-2 px-1">
                    <input type="number" step="0.5" value={s.weight} onChange={(e) => updateSet(i, { weight: e.target.value })} placeholder="kg"
                      className="w-20 rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm text-center font-mono" />
                  </td>
                  <td className="py-2 px-1">
                    <input type="number" value={s.reps} onChange={(e) => updateSet(i, { reps: e.target.value })} placeholder="reps"
                      className="w-16 rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm text-center font-mono" />
                  </td>
                  <td className="py-2 px-1 hidden sm:table-cell">
                    <input type="number" step="0.5" value={s.rpe} onChange={(e) => updateSet(i, { rpe: e.target.value })} placeholder="—"
                      className="w-14 rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm text-center font-mono" />
                  </td>
                  <td className="py-2 px-1 font-mono text-xs text-shred-muted/50 hidden sm:table-cell">
                    {prev ? `${prev.weight_kg} kg × ${prev.reps_done}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {suggestion && (
        <p className={`text-xs font-mono px-3 py-2 rounded-shred border ${allAtTop ? "border-shred-accent3 text-shred-accent3 bg-shred-accent3/10" : "border-shred-border text-shred-muted"}`}>
          {suggestion}
        </p>
      )}

      <label className="text-xs font-mono text-shred-muted block">
        Notes
        <input value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm" />
      </label>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function TrainingTab() {
  const [sessions, setSessions] = useState<SessionWithEx[]>([]);
  const [walks, setWalks] = useState<FastWalkRow[]>([]);
  const [useLocal, setUseLocal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("PUSH");
  const [newDate, setNewDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [draftEx, setDraftEx] = useState<Partial<ExerciseRow>[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [editType, setEditType] = useState("PUSH");
  const [logSessionId, setLogSessionId] = useState<number | "">("");
  const [logDate, setLogDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [logFields, setLogFields] = useState<LogFields>({});
  const [prevLogs, setPrevLogs] = useState<Record<number, WorkoutLogRow[]>>({});
  const [walkDur, setWalkDur] = useState("25");
  const [walkIncline, setWalkIncline] = useState("12");
  const [walkSpeed, setWalkSpeed] = useState("6.5");
  const [walkKm, setWalkKm] = useState("");
  const [walkNotes, setWalkNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const sRes = await fetch("/api/sessions");
    const sJ = await sRes.json();
    if (sRes.ok && sJ.ok) { setSessions(sJ.data as SessionWithEx[]); setUseLocal(false); }
    else { setUseLocal(true); setSessions((localStore.getSessions() as SessionWithEx[]) ?? []); }
    const wRes = await fetch("/api/walks");
    const wJ = await wRes.json();
    if (wRes.ok && wJ.ok) setWalks(wJ.data as FastWalkRow[]);
    else setWalks((localStore.getWalks() as FastWalkRow[]) ?? []);
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const selectedSession = useMemo(() => sessions.find((s) => s.id === logSessionId), [sessions, logSessionId]);

  useEffect(() => {
    if (!selectedSession) { setLogFields({}); setPrevLogs({}); return; }
    async function load() {
      const r = await fetchJson<WorkoutLogRow[]>(`/api/workout-logs?session_id=${selectedSession!.id}`);
      const all = r.data ?? (localStore.getWorkoutLogs() as WorkoutLogRow[]).filter((w) => w.session_id === selectedSession!.id);
      const dates = [...new Set(all.map((l) => l.date))].sort((a, b) => (a < b ? 1 : -1));
      const prevDate = dates.find((d) => d !== logDate);
      const prev: Record<number, WorkoutLogRow[]> = {};
      const today: Record<number, WorkoutLogRow[]> = {};
      for (const ex of selectedSession!.exercises) {
        prev[ex.id] = prevDate ? all.filter((l) => l.date === prevDate && l.exercise_name === ex.name).sort((a, b) => a.set_number - b.set_number) : [];
        today[ex.id] = all.filter((l) => l.date === logDate && l.exercise_name === ex.name).sort((a, b) => a.set_number - b.set_number);
      }
      setPrevLogs(prev);
      const init: LogFields = {};
      for (const ex of selectedSession!.exercises) {
        init[ex.id] = { sets: initSets(ex, today[ex.id]?.length ? today[ex.id] : prev[ex.id]?.length ? prev[ex.id] : undefined), notes: "" };
      }
      setLogFields(init);
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logSessionId, logDate, selectedSession?.id]);

  const weekWalks = useMemo(() => {
    const wk = isoWeekKey(new Date());
    return walks.filter((w) => isoWeekKey(new Date(w.date + "T12:00:00")) === wk).length;
  }, [walks]);

  function persistLocal(next: SessionWithEx[]) { setSessions(next); localStore.setSessions(next); }

  async function createSession(asTemplate: boolean) {
    if (!newName.trim()) { setMsg("Nom requis"); return; }
    const body = { name: newName.trim(), type: newType, date: newDate || null, template: asTemplate ? 1 : 0, notes: newNotes || null, exercises: [] };
    const res = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json();
    if (res.ok && j.ok) { setSessions((p) => [j.data as SessionWithEx, ...p]); setNewName(""); setNewDate(""); setNewNotes(""); setMsg("Séance créée"); return; }
    const id = nextLocalId(sessions);
    persistLocal([{ id, ...body, exercises: [] }, ...sessions]);
    setNewName(""); setNewDate(""); setNewNotes(""); setMsg("Enregistré en local");
  }

  function beginEdit(s: SessionWithEx) { setEditId(s.id); setEditType(s.type); setDraftEx(s.exercises.map((e) => ({ ...e }))); }
  function cancelEdit() { setEditId(null); setDraftEx([]); }

  async function saveEdit() {
    if (editId == null) return;
    const base = sessions.find((s) => s.id === editId);
    if (!base) return;
    const exercises = draftEx.map((e, i) => ({ name: (e.name ?? "").trim(), sets: Number(e.sets) || 3, reps_target: e.reps_target ?? "8-12", rest_seconds: Number(e.rest_seconds) || 90, order_index: i, notes: e.notes ?? null })).filter((e) => e.name.length > 0);
    const res = await fetch("/api/sessions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editId, name: base.name, type: base.type, date: base.date, template: base.template, notes: base.notes, exercises }) });
    const j = await res.json();
    if (res.ok && j.ok) { setSessions((p) => p.map((s) => (s.id === editId ? (j.data as SessionWithEx) : s))); setMsg("Séance enregistrée"); cancelEdit(); return; }
    const next = sessions.map((s) => s.id !== editId ? s : { ...s, exercises: exercises.map((ex, i) => ({ id: nextLocalId(s.exercises) + i, session_id: editId, ...ex })) });
    persistLocal(next); setMsg("Enregistré en local"); cancelEdit();
  }

  function addFromLib(tpl: ExerciseTemplate) {
    setDraftEx((d) => [...d, { name: tpl.name, sets: tpl.sets, reps_target: tpl.repRange, rest_seconds: tpl.rest, notes: "", order_index: d.length }]);
  }

  function moveEx(i: number, dir: -1 | 1) {
    setDraftEx((d) => { const j = i + dir; if (j < 0 || j >= d.length) return d; const c = [...d]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  }

  async function deleteSession(id: number) {
    if (!confirm("Supprimer cette séance ?")) return;
    const res = await fetch(`/api/sessions?id=${id}`, { method: "DELETE" });
    const j = await res.json();
    if (res.ok && j.ok) { setSessions((p) => p.filter((s) => s.id !== id)); return; }
    persistLocal(sessions.filter((s) => s.id !== id));
  }

  async function submitWorkout() {
    if (!selectedSession || logSessionId === "") { setMsg("Choisis une séance"); return; }
    const rows: { exercise_name: string; set_number: number; weight_kg: number; reps_done: string; rpe: number | null; notes: string | null }[] = [];
    for (const ex of selectedSession.exercises) {
      const f = logFields[ex.id];
      if (!f) continue;
      for (let i = 0; i < f.sets.length; i++) {
        const s = f.sets[i];
        const w = Number(s.weight);
        if (!s.weight || Number.isNaN(w)) { setMsg(`Charge manquante : ${ex.name} — série ${i + 1}`); return; }
        rows.push({ exercise_name: ex.name, set_number: i + 1, weight_kg: w, reps_done: s.reps || "0", rpe: s.rpe ? Number(s.rpe) : null, notes: f.notes || null });
      }
    }
    const res = await fetch("/api/workout-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: logSessionId, date: logDate, rows }) });
    const j = await res.json();
    if (res.ok && j.ok) { setMsg("✓ Séance enregistrée !"); return; }
    const existing = (localStore.getWorkoutLogs() as WorkoutLogRow[]).filter((x) => !(x.session_id === logSessionId && x.date === logDate));
    localStore.setWorkoutLogs([...rows.map((r, i) => ({ id: nextLocalId(existing) + i, session_id: logSessionId as number, date: logDate, ...r })), ...existing]);
    setMsg("Séance enregistrée en local");
  }

  async function submitWalk() {
    if (logSessionId === "") { setMsg("Choisis une séance"); return; }
    const dur = Number(walkDur);
    if (!dur || dur <= 0) { setMsg("Durée invalide"); return; }
    const body = { session_id: logSessionId, date: logDate, duration_minutes: dur, distance_km: walkKm ? Number(walkKm) : null, incline_percent: walkIncline ? Number(walkIncline) : null, speed_kmh: walkSpeed ? Number(walkSpeed) : null, notes: walkNotes || null };
    const res = await fetch("/api/walks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json();
    if (res.ok && j.ok) { setWalks((w) => [j.data as FastWalkRow, ...w]); setMsg("✓ Marche enregistrée"); return; }
    const all = localStore.getWalks() as FastWalkRow[];
    const row = { id: nextLocalId(all), ...body } as FastWalkRow;
    localStore.setWalks([row, ...all]); setWalks((w) => [row, ...w]); setMsg("Marche enregistrée (local)");
  }

  return (
    <div className="space-y-10">
      {showPicker && <ExercisePicker sessionType={editType} onPick={addFromLib} onClose={() => setShowPicker(false)} />}

      <header>
        <h1 className="font-display text-4xl tracking-[0.08em]">Entraînement</h1>
        <p className="text-shred-muted mt-2 text-sm">
          Bibliothèque d&apos;exercices · Suivi par série · Double progression
          {useLocal && <span className="ml-2 text-shred-accent font-mono text-xs">MODE LOCAL</span>}
        </p>
      </header>

      {/* Split */}
      <section>
        <h2 className="font-display text-xl tracking-wide mb-3">Split hebdomadaire</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {WEEKLY_SPLIT.map((d) => (
            <div key={d.day} className="rounded-shred border border-shred-border bg-shred-surface p-3 border-t-4 border-t-shred-accent3">
              <p className="font-mono text-xs text-shred-muted">{d.day}</p>
              <p className="font-display text-base mt-1">{d.label}</p>
              <p className="text-xs text-shred-muted mt-1">{d.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sessions */}
      <section className="rounded-shred border border-shred-border bg-shred-surface p-4 space-y-4">
        <h2 className="font-display text-2xl tracking-wide">Mes séances</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(["Nom", "Type", "Jour", "Notes"] as const).map(() => null)}
          <label className="text-xs font-mono text-shred-muted block">Nom<input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" /></label>
          <label className="text-xs font-mono text-shred-muted block">Type
            <select value={newType} onChange={(e) => setNewType(e.target.value)} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2">
              {SESSION_TYPES.map((t) => <option key={t} value={t}>{SESSION_TYPE_LABELS[t]}</option>)}
            </select>
          </label>
          <label className="text-xs font-mono text-shred-muted block">Jour<input value={newDate} onChange={(e) => setNewDate(e.target.value)} placeholder="ex. Lundi" className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" /></label>
          <label className="text-xs font-mono text-shred-muted block">Notes<input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" /></label>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => void createSession(false)} className="rounded-shred border border-shred-accent bg-shred-accent px-4 py-2 font-mono text-sm text-shred-bg">+ Nouvelle séance</button>
          <button type="button" onClick={() => void createSession(true)} className="rounded-shred border border-shred-border bg-shred-surface2 px-4 py-2 font-mono text-sm">+ Modèle</button>
        </div>
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-shred border border-shred-border bg-shred-surface2 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display text-xl">{s.name}</p>
                  <p className="font-mono text-xs text-shred-muted">{SESSION_TYPE_LABELS[s.type as keyof typeof SESSION_TYPE_LABELS] ?? s.type}{s.date ? ` · ${s.date}` : ""}{s.template ? " · MODÈLE" : ""}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => beginEdit(s)} className="rounded-shred border border-shred-border px-3 py-1 text-xs font-mono">Modifier</button>
                  <button type="button" onClick={() => void deleteSession(s.id)} className="rounded-shred border border-shred-accent2 px-3 py-1 text-xs font-mono text-shred-accent2">✕</button>
                </div>
              </div>
              {s.exercises.length > 0
                ? <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">{s.exercises.map((e) => <li key={e.id} className="text-xs text-shred-muted font-mono">• {e.name} — {e.sets}×{e.reps_target}</li>)}</ul>
                : <p className="text-xs text-shred-muted mt-2">Aucun exercice — clique Modifier.</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Edit panel */}
      {editId != null && (
        <section className="rounded-shred border-2 border-shred-accent3 bg-shred-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl">Exercices — {sessions.find((s) => s.id === editId)?.name}</h3>
            <button type="button" onClick={cancelEdit} className="font-mono text-xs text-shred-muted">Fermer ✕</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => setShowPicker(true)} className="rounded-shred border border-shred-accent3 bg-shred-accent3/10 px-3 py-2 font-mono text-xs text-shred-accent3">📚 Bibliothèque</button>
            <button type="button" onClick={() => setDraftEx((d) => [...d, { name: "", sets: 3, reps_target: "8-12", rest_seconds: 90, notes: "", order_index: d.length }])} className="rounded-shred border border-shred-border px-3 py-2 font-mono text-xs">+ Manuel</button>
          </div>
          {draftEx.map((ex, i) => (
            <div key={i} className="grid lg:grid-cols-12 gap-2 items-end border-b border-shred-border pb-3">
              <label className="lg:col-span-4 text-xs font-mono text-shred-muted block">Nom<input value={ex.name ?? ""} onChange={(e) => setDraftEx((d) => d.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm" /></label>
              <label className="lg:col-span-1 text-xs font-mono text-shred-muted block">Séries<input type="number" value={ex.sets ?? 3} onChange={(e) => setDraftEx((d) => d.map((x, j) => j === i ? { ...x, sets: Number(e.target.value) } : x))} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm" /></label>
              <label className="lg:col-span-2 text-xs font-mono text-shred-muted block">Reps<input value={ex.reps_target ?? ""} onChange={(e) => setDraftEx((d) => d.map((x, j) => j === i ? { ...x, reps_target: e.target.value } : x))} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm" /></label>
              <label className="lg:col-span-2 text-xs font-mono text-shred-muted block">Repos (s)<input type="number" value={ex.rest_seconds ?? 90} onChange={(e) => setDraftEx((d) => d.map((x, j) => j === i ? { ...x, rest_seconds: Number(e.target.value) } : x))} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm" /></label>
              <div className="lg:col-span-3 flex gap-1 items-end">
                <button type="button" onClick={() => moveEx(i, -1)} className="rounded-shred border border-shred-border px-2 py-1 text-xs">↑</button>
                <button type="button" onClick={() => moveEx(i, 1)} className="rounded-shred border border-shred-border px-2 py-1 text-xs">↓</button>
                <button type="button" onClick={() => setDraftEx((d) => d.filter((_, j) => j !== i))} className="rounded-shred border border-shred-accent2 px-2 py-1 text-xs text-shred-accent2">✕</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => void saveEdit()} className="rounded-shred border border-shred-accent bg-shred-accent px-4 py-2 font-mono text-sm text-shred-bg">Enregistrer</button>
        </section>
      )}

      {/* Workout logger */}
      <section className="rounded-shred border border-shred-border bg-shred-surface p-4 space-y-4">
        <div>
          <h2 className="font-display text-2xl tracking-wide">Journal de séance</h2>
          <p className="text-xs text-shred-muted mt-1">Double progression : augmente les reps jusqu&apos;à la borne haute → +2.5 kg la fois suivante</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs font-mono text-shred-muted block">Séance
            <select value={logSessionId === "" ? "" : String(logSessionId)} onChange={(e) => setLogSessionId(e.target.value ? Number(e.target.value) : "")} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2">
              <option value="">Choisir…</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name} ({SESSION_TYPE_LABELS[s.type as keyof typeof SESSION_TYPE_LABELS] ?? s.type})</option>)}
            </select>
          </label>
          <label className="text-xs font-mono text-shred-muted block">Date<input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" /></label>
        </div>
        {selectedSession && selectedSession.exercises.length > 0 ? (
          <div className="space-y-4">
            {selectedSession.exercises.map((ex) => (
              <ExerciseLogRow key={ex.id} ex={ex}
                value={logFields[ex.id] ?? { sets: Array.from({ length: ex.sets }, emptySet), notes: "" }}
                onChange={(v) => setLogFields((f) => ({ ...f, [ex.id]: v }))}
                prevRows={prevLogs[ex.id] ?? []}
              />
            ))}
            <button type="button" onClick={() => void submitWorkout()} className="w-full rounded-shred border border-shred-accent3 bg-shred-accent3/20 px-4 py-3 font-mono text-sm text-shred-accent3 font-bold">
              ✓ Enregistrer la performance
            </button>
          </div>
        ) : (
          <p className="text-sm text-shred-muted">{selectedSession ? "Ajoute des exercices via Modifier." : "Sélectionne une séance."}</p>
        )}
      </section>

      {/* Walk */}
      <section className="rounded-shred border border-shred-border bg-shred-surface p-4 space-y-3">
        <h2 className="font-display text-2xl tracking-wide">Marche rapide post-séance</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <label className="text-xs font-mono text-shred-muted block">Temps (min)<input type="number" value={walkDur} onChange={(e) => setWalkDur(e.target.value)} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" /></label>
          <label className="text-xs font-mono text-shred-muted block">Pente (%)<input type="number" step="0.5" value={walkIncline} onChange={(e) => setWalkIncline(e.target.value)} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" /></label>
          <label className="text-xs font-mono text-shred-muted block">Vitesse (km/h)<input type="number" step="0.1" value={walkSpeed} onChange={(e) => setWalkSpeed(e.target.value)} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" /></label>
          <label className="text-xs font-mono text-shred-muted block">Distance (km)<input type="number" step="0.01" value={walkKm} onChange={(e) => setWalkKm(e.target.value)} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" /></label>
          <label className="text-xs font-mono text-shred-muted block">Notes<input value={walkNotes} onChange={(e) => setWalkNotes(e.target.value)} className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" /></label>
        </div>
        <button type="button" onClick={() => void submitWalk()} className="rounded-shred border border-shred-border bg-shred-surface2 px-4 py-2 font-mono text-sm">Enregistrer la marche</button>
        <p className="font-mono text-sm text-shred-accent3">🚶 Marches cette semaine : {weekWalks}/5</p>
      </section>

      {msg && <p className={`font-mono text-sm ${msg.startsWith("✓") ? "text-green-400" : "text-shred-accent"}`}>{msg}</p>}
    </div>
  );
}
