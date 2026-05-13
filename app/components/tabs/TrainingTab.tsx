"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { SESSION_TYPE_LABELS, SESSION_TYPES, WEEKLY_SPLIT } from "@/lib/constants";
import type { ExerciseRow, FastWalkRow, SessionRow, WorkoutLogRow } from "@/lib/types";
import { isoWeekKey } from "@/lib/dates";
import { localStore, nextLocalId } from "@/lib/localStore";
import { EXERCISE_LIBRARY, MUSCLE_COLORS, type ExerciseTemplate } from "@/lib/exercise-library";
import { ConfirmDialog } from "@/app/components/ui/ConfirmDialog";

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

// ─── Rest Timer ──────────────────────────────────────────────────────────────

function RestTimer({ seconds, total, onDismiss }: { seconds: number; total: number; onDismiss: () => void }) {
  const size = 84;
  const sw = 6;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? seconds / total : 0;
  const done = seconds === 0;
  const color = done ? "#3bffd4" : "#f5c518";

  return (
    <div className="fixed bottom-24 lg:bottom-8 right-4 z-50 flex flex-col items-center gap-1 bg-shred-surface2/95 backdrop-blur-md border border-shred-border rounded-2xl p-3 shadow-2xl">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#18181d" strokeWidth={sw} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.4s" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-2xl font-bold tabular-nums" style={{ color }}>{seconds}</span>
        </div>
      </div>
      <p className="font-mono text-[10px] text-shred-muted uppercase tracking-widest">
        {done ? "C'est parti !" : "Repos"}
      </p>
      <button type="button" onClick={onDismiss} className="font-mono text-[10px] text-shred-muted/40 hover:text-shred-muted transition-colors mt-0.5">
        ✕ fermer
      </button>
    </div>
  );
}

// ─── Exercise Library Picker ──────────────────────────────────────────────────

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
        <input autoFocus placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-sm" />
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

// ─── Per-set logging row (collapsible) ───────────────────────────────────────

function ExerciseLogRow({ ex, value, onChange, history, onStartTimer }: {
  ex: ExerciseRow;
  value: ExLog;
  onChange: (v: ExLog) => void;
  history: { date: string; rows: WorkoutLogRow[] }[];
  onStartTimer?: (s: number) => void;
}) {
  const [open, setOpen] = useState(false);

  const histBySet = useMemo(() => history.map((h) => {
    const m: Record<number, WorkoutLogRow> = {};
    h.rows.forEach((r) => { m[r.set_number] = r; });
    return { date: h.date, bySet: m };
  }), [history]);

  const totalVol = value.sets.reduce((s, r) => s + (Number(r.weight) || 0) * (Number(r.reps) || 0), 0);
  const lastRows = history[0]?.rows ?? [];
  const prevVol = lastRows.reduce((s, r) => s + r.weight_kg * (Number(r.reps_done) || 0), 0);
  const diff = prevVol > 0 ? Math.round(((totalVol - prevVol) / prevVol) * 100) : null;

  const [, repHigh] = useMemo(() => {
    const m = ex.reps_target.match(/(\d+)[^\d]*(\d+)?/);
    return m ? [Number(m[1]), Number(m[2] ?? m[1])] : [8, 12];
  }, [ex.reps_target]);

  const allAtTop = lastRows.length > 0 && lastRows.every((r) => Number(r.reps_done) >= repHigh);
  const maxPrevWeight = lastRows.length > 0 ? Math.max(...lastRows.map((r) => r.weight_kg)) : 0;
  const suggestion = allAtTop
    ? `🎉 Surcharge ! Passe à ${(maxPrevWeight + 2.5).toFixed(1)} kg la prochaine fois`
    : lastRows.length > 0
    ? `🎯 Continue à ${maxPrevWeight} kg — vise ${repHigh} reps`
    : null;

  function updateSet(i: number, patch: Partial<SetLog>) {
    onChange({ ...value, sets: value.sets.map((s, idx) => idx === i ? { ...s, ...patch } : s) });
  }

  return (
    <div className="rounded-shred border border-shred-border bg-shred-surface2 overflow-hidden">
      {/* ── Collapsed header ── always visible ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen((o) => !o); }}
        className="flex items-center gap-3 p-3 cursor-pointer select-none"
      >
        <div className="flex-1 min-w-0">
          <p className="font-display text-base leading-tight truncate">{ex.name}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className="text-[11px] font-mono text-shred-muted">{ex.sets}×{ex.reps_target}</span>
            {diff !== null && (
              <span className={`font-mono text-[10px] px-1.5 py-px rounded border leading-none ${
                diff > 0 ? "border-green-500/60 text-green-400" :
                diff < 0 ? "border-red-500/60 text-red-400" :
                "border-shred-border text-shred-muted"
              }`}>
                {diff > 0 ? `↑+${diff}%` : diff < 0 ? `↓${diff}%` : "="}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onStartTimer && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onStartTimer(ex.rest_seconds); }}
              className="text-[11px] font-mono text-shred-accent3 border border-shred-accent3/40 bg-shred-accent3/10 px-2 py-0.5 rounded-shred hover:bg-shred-accent3/20 transition-colors"
            >
              ⏱ {ex.rest_seconds}s
            </button>
          )}
          <span className={`text-shred-muted text-[10px] font-mono transition-transform duration-200 ${open ? "rotate-90" : ""}`}>▶</span>
        </div>
      </div>

      {/* ── Expandable content ── */}
      <div className={`overflow-hidden transition-[max-height] duration-200 ease-out ${open ? "max-h-[600px]" : "max-h-0"}`}>
        <div className="border-t border-shred-border/60 px-3 pb-3 pt-3 space-y-3">
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="font-mono text-xs text-shred-muted">
                  <th className="text-left py-1 px-1 w-8">#</th>
                  {histBySet.map((h, i) => (
                    <th key={i} className="text-left py-1 px-1 text-shred-accent3/70 whitespace-nowrap">
                      {format(parseISO(h.date + "T12:00:00"), "d MMM", { locale: fr })}
                    </th>
                  ))}
                  <th className="text-left py-1 px-1">kg</th>
                  <th className="text-left py-1 px-1">Reps</th>
                  <th className="text-left py-1 px-1">RPE</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {value.sets.map((s, i) => (
                  <tr key={i} className="border-t border-shred-border/40">
                    <td className="py-2 px-1 font-mono text-shred-muted text-xs font-bold">{i + 1}</td>
                    {histBySet.map((h, hi) => {
                      const prev = h.bySet[i + 1];
                      return (
                        <td key={hi} className="py-2 px-1 font-mono text-xs text-shred-muted/60 whitespace-nowrap">
                          {prev ? `${prev.weight_kg}×${prev.reps_done}` : "—"}
                        </td>
                      );
                    })}
                    <td className="py-2 px-1">
                      <input type="number" step="0.5" value={s.weight} onChange={(e) => updateSet(i, { weight: e.target.value })} placeholder="kg"
                        className="w-20 rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm text-center font-mono" />
                    </td>
                    <td className="py-2 px-1">
                      <input type="number" value={s.reps} onChange={(e) => updateSet(i, { reps: e.target.value })} placeholder="reps"
                        className="w-16 rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm text-center font-mono" />
                    </td>
                    <td className="py-2 px-1">
                      <input type="number" step="0.5" value={s.rpe} onChange={(e) => updateSet(i, { rpe: e.target.value })} placeholder="—"
                        className="w-14 rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm text-center font-mono" />
                    </td>
                    <td className="py-2 px-1">
                      <button type="button"
                        onClick={() => { if (value.sets.length > 1) onChange({ ...value, sets: value.sets.filter((_, idx) => idx !== i) }); }}
                        className="text-shred-muted/40 hover:text-shred-accent2 font-mono text-sm leading-none px-1">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button"
            onClick={() => onChange({ ...value, sets: [...value.sets, value.sets.length > 0 ? { ...value.sets[value.sets.length - 1] } : emptySet()] })}
            className="text-xs font-mono text-shred-muted hover:text-shred-text border border-dashed border-shred-border rounded-shred px-3 py-1.5 w-full">
            + série
          </button>

          {suggestion && (
            <p className={`text-xs font-mono px-3 py-2 rounded-shred border ${allAtTop ? "border-shred-accent3 text-shred-accent3 bg-shred-accent3/10" : "border-shred-border text-shred-muted"}`}>
              {suggestion}
            </p>
          )}

          <label className="text-xs font-mono text-shred-muted block">
            Notes
            <input value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm" />
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function TrainingTab({ onSessionMutated }: { onSessionMutated?: () => void }) {
  const [sessions, setSessions] = useState<SessionWithEx[]>([]);
  const [walks, setWalks] = useState<FastWalkRow[]>([]);
  const [useLocal, setUseLocal] = useState(false);
  const [showManage, setShowManage] = useState(false);
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
  const [prevLogs, setPrevLogs] = useState<Record<number, { date: string; rows: WorkoutLogRow[] }[]>>({});
  const [walkDur, setWalkDur] = useState("25");
  const [walkIncline, setWalkIncline] = useState("12");
  const [walkSpeed, setWalkSpeed] = useState("6.5");
  const [walkKm, setWalkKm] = useState("");
  const [walkNotes, setWalkNotes] = useState("");
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [timer, setTimer] = useState<{ seconds: number; total: number } | null>(null);
  // Confirmation — supprimer séance complète (cascade)
  const [deleteSessionId, setDeleteSessionId] = useState<number | null>(null);
  // Confirmation — supprimer un modèle uniquement (keepLogs)
  const [deleteTemplateId, setDeleteTemplateId] = useState<number | null>(null);
  const [deleteTemplateName, setDeleteTemplateName] = useState("");
  // Journal visibility toggle — closed by default
  const [showJournal, setShowJournal] = useState(false);
  // 2-step delete-log modal (FIX 3)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteModalStep, setDeleteModalStep] = useState<1 | 2>(1);
  const [deleteModalSessionName, setDeleteModalSessionName] = useState("");
  const [deleteModalDate, setDeleteModalDate] = useState("");
  const [deleteModalDates, setDeleteModalDates] = useState<string[]>([]);
  const [deleteModalLoading, setDeleteModalLoading] = useState(false);

  function showToast(text: string, ok = true) {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3500);
  }

  // Today's position in the weekly split (0 = Mon, 6 = Sun) — used for header display only
  const todaySplitIdx = (new Date().getDay() + 6) % 7;
  const todaySplit = WEEKLY_SPLIT[todaySplitIdx];

  useEffect(() => {
    if (!timer || timer.seconds <= 0) return;
    const id = setTimeout(() => {
      setTimer((t) => (t && t.seconds > 0 ? { ...t, seconds: t.seconds - 1 } : t));
    }, 1000);
    return () => clearTimeout(id);
  }, [timer]);

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
      const prevDates = dates.filter((d) => d !== logDate).slice(0, 3);
      const prev: Record<number, { date: string; rows: WorkoutLogRow[] }[]> = {};
      const today: Record<number, WorkoutLogRow[]> = {};
      for (const ex of selectedSession!.exercises) {
        prev[ex.id] = prevDates
          .map((date) => ({
            date,
            rows: all.filter((l) => l.date === date && l.exercise_name === ex.name).sort((a, b) => a.set_number - b.set_number),
          }))
          .filter((h) => h.rows.length > 0);
        today[ex.id] = all.filter((l) => l.date === logDate && l.exercise_name === ex.name).sort((a, b) => a.set_number - b.set_number);
      }
      setPrevLogs(prev);
      const init: LogFields = {};
      for (const ex of selectedSession!.exercises) {
        const mostRecentPrev = prev[ex.id]?.[0]?.rows;
        init[ex.id] = { sets: initSets(ex, today[ex.id]?.length ? today[ex.id] : mostRecentPrev?.length ? mostRecentPrev : undefined), notes: "" };
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
    if (!newName.trim()) { showToast("Nom requis", false); return; }
    const body = { name: newName.trim(), type: newType, date: newDate || null, template: asTemplate ? 1 : 0, notes: newNotes || null, exercises: [] };
    const res = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json();
    if (res.ok && j.ok) { setSessions((p) => [j.data as SessionWithEx, ...p]); setNewName(""); setNewDate(""); setNewNotes(""); showToast("Séance créée"); return; }
    const id = nextLocalId(sessions);
    persistLocal([{ id, ...body, exercises: [] }, ...sessions]);
    setNewName(""); setNewDate(""); setNewNotes(""); showToast("Enregistré en local");
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
    if (res.ok && j.ok) { setSessions((p) => p.map((s) => (s.id === editId ? (j.data as SessionWithEx) : s))); showToast("Séance enregistrée"); cancelEdit(); return; }
    const next = sessions.map((s) => s.id !== editId ? s : { ...s, exercises: exercises.map((ex, i) => ({ id: nextLocalId(s.exercises) + i, session_id: editId, ...ex })) });
    persistLocal(next); showToast("Enregistré en local"); cancelEdit();
  }

  async function confirmDeleteSession() {
    if (deleteSessionId == null) return;
    const id = deleteSessionId;
    setDeleteSessionId(null);
    if (logSessionId === id) setLogSessionId("");
    const res = await fetch(`/api/sessions?id=${id}`, { method: "DELETE" });
    const j = await res.json();
    if (res.ok && j.ok) {
      setSessions((p) => p.filter((s) => s.id !== id));
      onSessionMutated?.();
      showToast("Séance supprimée");
      return;
    }
    persistLocal(sessions.filter((s) => s.id !== id));
    onSessionMutated?.();
    showToast("Supprimé en local");
  }

  async function confirmDeleteTemplate() {
    if (deleteTemplateId == null) return;
    const id = deleteTemplateId;
    setDeleteTemplateId(null);
    if (logSessionId === id) setLogSessionId("");
    const res = await fetch(`/api/sessions?id=${id}&keepLogs=1`, { method: "DELETE" });
    const j = await res.json();
    if (res.ok && j.ok) {
      setSessions((p) => p.filter((s) => s.id !== id));
      showToast("Modèle supprimé");
      return;
    }
    persistLocal(sessions.filter((s) => s.id !== id));
    showToast("Supprimé en local");
  }

  async function confirmDeleteSpecificLog() {
    const sess = sessions.find((s) => s.name === deleteModalSessionName);
    if (!sess || !deleteModalDate) return;
    setShowDeleteModal(false);
    const res = await fetch(`/api/workout-logs?session_id=${sess.id}&date=${deleteModalDate}`, { method: "DELETE" });
    const j = await res.json();
    if (res.ok && j.ok) {
      onSessionMutated?.();
      // If the deleted log matches the currently viewed session+date, reset fields
      if (logSessionId === sess.id && logDate === deleteModalDate) {
        const init: LogFields = {};
        for (const ex of (selectedSession?.exercises ?? [])) {
          init[ex.id] = { sets: initSets(ex), notes: "" };
        }
        setLogFields(init);
      }
      showToast("✓ Séance supprimée");
    } else {
      const existing = (localStore.getWorkoutLogs() as WorkoutLogRow[])
        .filter((x) => !(x.session_id === sess.id && x.date === deleteModalDate));
      localStore.setWorkoutLogs(existing);
      showToast("Effacé en local");
    }
  }

  function openDeleteModal() {
    setDeleteModalSessionName("");
    setDeleteModalDate("");
    setDeleteModalDates([]);
    setDeleteModalStep(1);
    setShowDeleteModal(true);
  }

  function addFromLib(tpl: ExerciseTemplate) {
    setDraftEx((d) => [...d, { name: tpl.name, sets: tpl.sets, reps_target: tpl.repRange, rest_seconds: tpl.rest, notes: "", order_index: d.length }]);
  }

  function moveEx(i: number, dir: -1 | 1) {
    setDraftEx((d) => { const j = i + dir; if (j < 0 || j >= d.length) return d; const c = [...d]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  }

  async function submitWorkout() {
    if (!selectedSession || logSessionId === "") { showToast("Choisis une séance", false); return; }
    const rows: { exercise_name: string; set_number: number; weight_kg: number; reps_done: string; rpe: number | null; notes: string | null }[] = [];
    for (const ex of selectedSession.exercises) {
      const f = logFields[ex.id];
      if (!f) continue;
      for (let i = 0; i < f.sets.length; i++) {
        const s = f.sets[i];
        const w = Number(s.weight);
        if (!s.weight || Number.isNaN(w)) { showToast(`Charge manquante : ${ex.name} — série ${i + 1}`, false); return; }
        rows.push({ exercise_name: ex.name, set_number: i + 1, weight_kg: w, reps_done: s.reps || "0", rpe: s.rpe ? Number(s.rpe) : null, notes: f.notes || null });
      }
    }
    showToast("✓ Performance enregistrée !");
    setLastSaved(new Date());
    fetch("/api/workout-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: logSessionId, date: logDate, rows }) })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok || !j.ok) {
          const existing = (localStore.getWorkoutLogs() as WorkoutLogRow[]).filter((x) => !(x.session_id === logSessionId && x.date === logDate));
          localStore.setWorkoutLogs([...rows.map((r, i) => ({ id: nextLocalId(existing) + i, session_id: logSessionId as number, date: logDate, ...r })), ...existing]);
          showToast("✗ Réseau — sauvegardé en local", false);
        }
      })
      .catch(() => {
        const existing = (localStore.getWorkoutLogs() as WorkoutLogRow[]).filter((x) => !(x.session_id === logSessionId && x.date === logDate));
        localStore.setWorkoutLogs([...rows.map((r, i) => ({ id: nextLocalId(existing) + i, session_id: logSessionId as number, date: logDate, ...r })), ...existing]);
        showToast("✗ Hors ligne — sauvegardé en local", false);
      });
  }

  async function submitWalk() {
    const dur = Number(walkDur);
    if (!dur || dur <= 0) { showToast("Durée invalide", false); return; }
    const body = { session_id: logSessionId || null, date: logDate, duration_minutes: dur, distance_km: walkKm ? Number(walkKm) : null, incline_percent: walkIncline ? Number(walkIncline) : null, speed_kmh: walkSpeed ? Number(walkSpeed) : null, notes: walkNotes || null };
    const res = await fetch("/api/walks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json();
    if (res.ok && j.ok) { setWalks((w) => [j.data as FastWalkRow, ...w]); showToast("✓ Marche enregistrée"); return; }
    const all = localStore.getWalks() as FastWalkRow[];
    const row = { id: nextLocalId(all), ...body } as FastWalkRow;
    localStore.setWalks([row, ...all]); setWalks((w) => [row, ...w]); showToast("Marche enregistrée (local)");
  }

  return (
    <div className="space-y-8">
      {showPicker && <ExercisePicker sessionType={editType} onPick={addFromLib} onClose={() => setShowPicker(false)} />}
      {timer && <RestTimer seconds={timer.seconds} total={timer.total} onDismiss={() => setTimer(null)} />}

      {/* Confirmation — supprimer une séance (cascade complète) */}
      {deleteSessionId != null && (
        <ConfirmDialog
          title="Supprimer cette séance ?"
          message="Cette action est irréversible. Tous les exercices et l'historique de performances associés seront supprimés définitivement."
          confirmLabel="Confirmer la suppression"
          danger
          onConfirm={() => void confirmDeleteSession()}
          onCancel={() => setDeleteSessionId(null)}
        />
      )}

      {/* Confirmation — supprimer un modèle (garde l'historique) */}
      {deleteTemplateId != null && (
        <ConfirmDialog
          title={`Supprimer le modèle ${deleteTemplateName} ?`}
          message="Les séances déjà enregistrées avec ce modèle ne seront pas supprimées. Seule la définition du modèle sera effacée."
          confirmLabel="Supprimer le modèle"
          danger
          onConfirm={() => void confirmDeleteTemplate()}
          onCancel={() => setDeleteTemplateId(null)}
        />
      )}

      {/* ── Modal FIX 3 étape 1 — sélection séance + date ── */}
      {showDeleteModal && deleteModalStep === 1 && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="w-full max-w-sm rounded-shred border border-shred-border bg-shred-bg p-5 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl">Supprimer une séance</h3>
            <label className="text-xs font-mono text-shred-muted block">
              Séance
              <select
                value={deleteModalSessionName}
                onChange={async (e) => {
                  const name = e.target.value;
                  setDeleteModalSessionName(name);
                  setDeleteModalDate("");
                  if (name) {
                    setDeleteModalLoading(true);
                    const sess = sessions.find((s) => s.name === name);
                    if (sess) {
                      const r = await fetchJson<WorkoutLogRow[]>(`/api/workout-logs?session_id=${sess.id}`);
                      const rows = r.data ?? [];
                      const dates = [...new Set(rows.map((w) => w.date))].sort((a, b) => b.localeCompare(a));
                      setDeleteModalDates(dates);
                    }
                    setDeleteModalLoading(false);
                  } else {
                    setDeleteModalDates([]);
                  }
                }}
                className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 font-mono text-sm"
              >
                <option value="">Choisir une séance…</option>
                {sessions.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-mono text-shred-muted block">
              Date
              <select
                value={deleteModalDate}
                onChange={(e) => setDeleteModalDate(e.target.value)}
                disabled={!deleteModalSessionName || deleteModalLoading || deleteModalDates.length === 0}
                className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 font-mono text-sm disabled:opacity-40"
              >
                <option value="">
                  {deleteModalLoading ? "Chargement…" : deleteModalDates.length === 0 && deleteModalSessionName ? "Aucune séance enregistrée" : "Choisir une date…"}
                </option>
                {deleteModalDates.map((d) => (
                  <option key={d} value={d}>{format(parseISO(d + "T12:00:00"), "d MMMM yyyy", { locale: fr })}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowDeleteModal(false)}
                className="rounded-shred border border-shred-border px-4 py-2 font-mono text-sm text-shred-muted">
                Annuler
              </button>
              <button
                type="button"
                disabled={!deleteModalSessionName || !deleteModalDate}
                onClick={() => setDeleteModalStep(2)}
                className="rounded-shred border border-shred-accent3 bg-shred-accent3/20 px-4 py-2 font-mono text-sm text-shred-accent3 disabled:opacity-40"
              >
                Suivant →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal FIX 3 étape 2 — confirmation ── */}
      {showDeleteModal && deleteModalStep === 2 && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="w-full max-w-sm rounded-shred border border-shred-border bg-shred-bg p-5 space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl">Confirmer la suppression</h3>
            <p className="font-mono text-sm text-shred-text">
              Supprimer la séance{" "}
              <span className="text-shred-accent font-bold">{deleteModalSessionName.toUpperCase()}</span>{" "}
              du{" "}
              <span className="text-shred-accent font-bold">
                {deleteModalDate ? format(parseISO(deleteModalDate + "T12:00:00"), "d MMMM yyyy", { locale: fr }) : ""}
              </span>{" "}?
            </p>
            <p className="text-xs text-shred-muted">
              Cette action supprimera aussi tous les exercices et performances enregistrés pour cette séance.
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setDeleteModalStep(1)}
                className="rounded-shred border border-shred-border px-4 py-2 font-mono text-sm text-shred-muted">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteSpecificLog()}
                className="rounded-shred border border-red-500 bg-red-500/20 px-4 py-2 font-mono text-sm text-red-400 font-bold hover:bg-red-500/30 transition-colors"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-[0.08em]">Entraînement</h1>
          <p className="text-shred-muted mt-1 text-sm">
            Double progression · Suivi par série
            {useLocal && <span className="ml-2 text-shred-accent font-mono text-xs">LOCAL</span>}
          </p>
        </div>
        {todaySplit && (
          <div className="shrink-0 text-right pt-1">
            <p className="font-mono text-[10px] text-shred-muted uppercase tracking-widest">Aujourd&apos;hui</p>
            <p className={`font-display text-xl mt-0.5 ${todaySplit.label === "REPOS" ? "text-shred-muted" : "text-shred-accent"}`}>
              {todaySplit.label}
            </p>
            <p className="font-mono text-[10px] text-shred-muted mt-0.5">{todaySplit.detail}</p>
          </div>
        )}
      </header>

      {/* ── Journal de séance ─────────────────────────────────────────────── */}
      <section className="rounded-shred border border-shred-border bg-shred-surface overflow-hidden">
        {/* Header — toujours visible */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-display text-xl tracking-wide">Journal de séance</span>
          <div className="flex items-center gap-2">
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={openDeleteModal}
                title="Supprimer une séance enregistrée"
                className="rounded-shred border border-shred-border px-2 py-1.5 font-mono text-xs text-shred-muted hover:text-shred-accent2 hover:border-shred-accent2 transition-colors"
              >
                🗑
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowJournal((v) => !v)}
              className="rounded-shred border border-shred-border px-3 py-1.5 font-mono text-xs text-shred-muted hover:text-shred-text hover:border-shred-text transition-colors"
            >
              {showJournal ? "▲ Fermer" : "▼ Gérer"}
            </button>
          </div>
        </div>

        {/* Contenu — masquable */}
        {showJournal && (
          <div className="border-t border-shred-border p-4 space-y-4">
            <p className="text-xs text-shred-muted">Reps max sur toutes les séries → +2.5 kg la prochaine fois</p>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-mono text-shred-muted block">Séance
                <select
                  value={logSessionId === "" ? "" : String(logSessionId)}
                  onChange={(e) => setLogSessionId(e.target.value ? Number(e.target.value) : "")}
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
                >
                  <option value="">Choisir…</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({SESSION_TYPE_LABELS[s.type as keyof typeof SESSION_TYPE_LABELS] ?? s.type})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-mono text-shred-muted block">Date
                <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)}
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" />
              </label>
            </div>

            {selectedSession && selectedSession.exercises.length > 0 ? (
              <div className="space-y-2">
                {selectedSession.exercises.map((ex) => (
                  <ExerciseLogRow key={ex.id} ex={ex}
                    value={logFields[ex.id] ?? { sets: Array.from({ length: ex.sets }, emptySet), notes: "" }}
                    onChange={(v) => setLogFields((f) => ({ ...f, [ex.id]: v }))}
                    history={prevLogs[ex.id] ?? []}
                    onStartTimer={(s) => setTimer({ seconds: s, total: s })}
                  />
                ))}
                <div className="flex items-center gap-3 pt-2">
                  <button type="button" onClick={() => void submitWorkout()}
                    className="flex-1 rounded-shred border border-shred-accent3 bg-shred-accent3/20 px-4 py-3 font-mono text-sm text-shred-accent3 font-bold">
                    ✓ Enregistrer la performance
                  </button>
                  {lastSaved && (
                    <span className="text-xs font-mono text-shred-muted shrink-0">
                      Sauvegardé {Math.round((Date.now() - lastSaved.getTime()) / 1000)}s
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-shred-muted">
                {selectedSession ? "Ajoute des exercices via « Mes séances »." : "Sélectionne une séance."}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── Marche post-séance ─────────────────────────────────────────────── */}
      <section className="rounded-shred border border-shred-border bg-shred-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl tracking-wide">Marche post-séance</h2>
          <span className="font-mono text-sm text-shred-accent3">🚶 {weekWalks}/5 cette semaine</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="text-xs font-mono text-shred-muted block">Durée (min)
            <input type="number" value={walkDur} onChange={(e) => setWalkDur(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" />
          </label>
          <label className="text-xs font-mono text-shred-muted block">Pente (%)
            <input type="number" step="0.5" value={walkIncline} onChange={(e) => setWalkIncline(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" />
          </label>
          <label className="text-xs font-mono text-shred-muted block">Vitesse (km/h)
            <input type="number" step="0.1" value={walkSpeed} onChange={(e) => setWalkSpeed(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" />
          </label>
          <label className="text-xs font-mono text-shred-muted block">Distance (km)
            <input type="number" step="0.01" value={walkKm} onChange={(e) => setWalkKm(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" />
          </label>
        </div>
        <div className="flex gap-3 items-end">
          <label className="text-xs font-mono text-shred-muted block flex-1">Notes
            <input value={walkNotes} onChange={(e) => setWalkNotes(e.target.value)}
              className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" />
          </label>
          <button type="button" onClick={() => void submitWalk()}
            className="rounded-shred border border-shred-border bg-shred-surface2 px-4 py-2 font-mono text-sm shrink-0">
            Enregistrer
          </button>
        </div>
      </section>

      {/* ── Mes séances (gestion, collapsed) ──────────────────────────────── */}
      <section className="rounded-shred border border-shred-border bg-shred-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setShowManage((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-shred-surface2 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="font-display text-xl tracking-wide">Mes séances</span>
            {sessions.length > 0 && (
              <span className="font-mono text-xs text-shred-muted border border-shred-border rounded-shred px-2 py-0.5">
                {sessions.length}
              </span>
            )}
          </div>
          <span className="font-mono text-xs text-shred-muted">{showManage ? "▲ Fermer" : "▼ Gérer"}</span>
        </button>

        {showManage && (
          <div className="border-t border-shred-border p-4 space-y-4">
            {/* Create form */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="text-xs font-mono text-shred-muted block">Nom
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" />
              </label>
              <label className="text-xs font-mono text-shred-muted block">Type
                <select value={newType} onChange={(e) => setNewType(e.target.value)}
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2">
                  {SESSION_TYPES.map((t) => <option key={t} value={t}>{SESSION_TYPE_LABELS[t]}</option>)}
                </select>
              </label>
              <label className="text-xs font-mono text-shred-muted block">Jour
                <input value={newDate} onChange={(e) => setNewDate(e.target.value)} placeholder="ex. Lundi"
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" />
              </label>
              <label className="text-xs font-mono text-shred-muted block">Notes
                <input value={newNotes} onChange={(e) => setNewNotes(e.target.value)}
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2" />
              </label>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => void createSession(false)}
                className="rounded-shred border border-shred-accent bg-shred-accent px-4 py-2 font-mono text-sm text-shred-bg">
                + Nouvelle séance
              </button>
              <button type="button" onClick={() => void createSession(true)}
                className="rounded-shred border border-shred-border bg-shred-surface2 px-4 py-2 font-mono text-sm">
                + Modèle
              </button>
            </div>

            {/* Session list — separated by type */}
            {(() => {
              const regular = sessions.filter((s) => !s.template);
              const templates = sessions.filter((s) => !!s.template);
              const renderCard = (s: SessionWithEx, isTemplate: boolean) => (
                <div key={s.id} className={`rounded-shred border p-3 ${isTemplate ? "border-shred-border/40 bg-shred-surface2/50" : "border-shred-border bg-shred-surface2"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`font-display text-xl ${isTemplate ? "text-shred-muted" : ""}`}>{s.name}</p>
                        {isTemplate && (
                          <span className="font-mono text-[9px] uppercase tracking-widest border border-shred-border/50 text-shred-muted/60 px-1.5 py-0.5 rounded">
                            modèle
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-shred-muted/70">
                        {SESSION_TYPE_LABELS[s.type as keyof typeof SESSION_TYPE_LABELS] ?? s.type}
                        {s.date ? ` · ${s.date}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => beginEdit(s)}
                        className="rounded-shred border border-shred-border px-3 py-1 text-xs font-mono">
                        Modifier
                      </button>
                      {isTemplate ? (
                        <button
                          type="button"
                          onClick={() => { setDeleteTemplateId(s.id); setDeleteTemplateName(s.name); }}
                          className="rounded-shred border border-red-500/40 px-3 py-1 text-xs font-mono text-red-400 hover:border-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          🗑
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteSessionId(s.id)}
                          className="rounded-shred border border-red-500/40 px-3 py-1 text-xs font-mono text-red-400 hover:border-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                  {s.exercises.length > 0
                    ? <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {s.exercises.map((e) => (
                          <li key={e.id} className={`text-xs font-mono ${isTemplate ? "text-shred-muted/50" : "text-shred-muted"}`}>
                            • {e.name} — {e.sets}×{e.reps_target}
                          </li>
                        ))}
                      </ul>
                    : <p className={`text-xs mt-2 ${isTemplate ? "text-shred-muted/50" : "text-shred-muted"}`}>Aucun exercice — clique Modifier.</p>}
                </div>
              );
              return (
                <div className="space-y-4">
                  {regular.length > 0 && (
                    <div className="space-y-3">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-shred-muted">Séances enregistrées</p>
                      {regular.map((s) => renderCard(s, false))}
                    </div>
                  )}
                  {templates.length > 0 && (
                    <div className="space-y-3">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-shred-muted/50">Mes modèles</p>
                      {templates.map((s) => renderCard(s, true))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Edit panel */}
            {editId != null && (
              <div className="rounded-shred border-2 border-shred-accent3 bg-shred-surface p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl">Exercices — {sessions.find((s) => s.id === editId)?.name}</h3>
                  <button type="button" onClick={cancelEdit} className="font-mono text-xs text-shred-muted">Fermer ✕</button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={() => setShowPicker(true)}
                    className="rounded-shred border border-shred-accent3 bg-shred-accent3/10 px-3 py-2 font-mono text-xs text-shred-accent3">
                    📚 Bibliothèque
                  </button>
                  <button type="button"
                    onClick={() => setDraftEx((d) => [...d, { name: "", sets: 3, reps_target: "8-12", rest_seconds: 90, notes: "", order_index: d.length }])}
                    className="rounded-shred border border-shred-border px-3 py-2 font-mono text-xs">
                    + Manuel
                  </button>
                </div>
                {draftEx.map((ex, i) => (
                  <div key={i} className="grid lg:grid-cols-12 gap-2 items-end border-b border-shred-border pb-3">
                    <label className="lg:col-span-4 text-xs font-mono text-shred-muted block">Nom
                      <input value={ex.name ?? ""} onChange={(e) => setDraftEx((d) => d.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm" />
                    </label>
                    <label className="lg:col-span-1 text-xs font-mono text-shred-muted block">Séries
                      <input type="number" value={ex.sets ?? 3} onChange={(e) => setDraftEx((d) => d.map((x, j) => j === i ? { ...x, sets: Number(e.target.value) } : x))}
                        className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm" />
                    </label>
                    <label className="lg:col-span-2 text-xs font-mono text-shred-muted block">Reps
                      <input value={ex.reps_target ?? ""} onChange={(e) => setDraftEx((d) => d.map((x, j) => j === i ? { ...x, reps_target: e.target.value } : x))}
                        className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm" />
                    </label>
                    <label className="lg:col-span-2 text-xs font-mono text-shred-muted block">Repos (s)
                      <input type="number" value={ex.rest_seconds ?? 90} onChange={(e) => setDraftEx((d) => d.map((x, j) => j === i ? { ...x, rest_seconds: Number(e.target.value) } : x))}
                        className="mt-1 w-full rounded-shred border border-shred-border bg-shred-bg px-2 py-1.5 text-sm" />
                    </label>
                    <div className="lg:col-span-3 flex gap-1 items-end">
                      <button type="button" onClick={() => moveEx(i, -1)} className="rounded-shred border border-shred-border px-2 py-1 text-xs">↑</button>
                      <button type="button" onClick={() => moveEx(i, 1)} className="rounded-shred border border-shred-border px-2 py-1 text-xs">↓</button>
                      <button type="button" onClick={() => setDraftEx((d) => d.filter((_, j) => j !== i))}
                        className="rounded-shred border border-shred-accent2 px-2 py-1 text-xs text-shred-accent2">✕</button>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => void saveEdit()}
                  className="rounded-shred border border-shred-accent bg-shred-accent px-4 py-2 font-mono text-sm text-shred-bg">
                  Enregistrer
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-shred border font-mono text-sm shadow-lg ${
          toast.ok
            ? "bg-shred-surface2 border-shred-accent3 text-shred-accent3"
            : "bg-shred-surface2 border-shred-accent2 text-shred-accent2"
        }`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
