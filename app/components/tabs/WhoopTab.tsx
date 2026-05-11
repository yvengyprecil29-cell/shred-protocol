"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WhoopRow } from "@/lib/types";
import { localStore, nextLocalId } from "@/lib/localStore";

function coachingCard(score: number) {
  if (score >= 67) {
    return {
      tone: "green" as const,
      title: "✅ Séance complète",
      body: "Entraîne-toi à pleine intensité. Surcharge progressive si les reps suivent. Strain cible : 14–16.",
    };
  }
  if (score >= 34) {
    return {
      tone: "yellow" as const,
      title: "⚡ Séance normale, pas de records",
      body: "Mêmes charges, focus sur la technique. Retire 1 série si besoin. Hydratation ++.",
    };
  }
  return {
    tone: "red" as const,
    title: "🔴 Récupération active seulement",
    body: "Marche rapide 20–30 min. Pas de charges lourdes aujourd'hui. Priorité : sommeil, alimentation, eau.",
  };
}

export function WhoopTab() {
  const [rows, setRows] = useState<WhoopRow[]>([]);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [recovery, setRecovery] = useState("72");
  const [hrv, setHrv] = useState("");
  const [rhr, setRhr] = useState("");
  const [sleepH, setSleepH] = useState("");
  const [sleepScore, setSleepScore] = useState("");
  const [strain, setStrain] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/whoop");
    const j = await res.json();
    if (res.ok && j.ok) setRows(j.data as WhoopRow[]);
    else setRows(localStore.getWhoop() as WhoopRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)), [rows]);

  const last7 = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 6);
    return sorted
      .filter((r) => {
        const d = parseISO(r.date + "T12:00:00");
        return d >= start && d <= end;
      })
      .map((r) => ({ date: r.date.slice(5), hrv: r.hrv ?? 0 }));
  }, [sorted]);

  const weekAvg = useMemo(() => {
    const wk = sorted.filter((r) => {
      const d = parseISO(r.date + "T12:00:00");
      const diff = (Date.now() - d.getTime()) / 86400000;
      return diff >= 0 && diff <= 7;
    });
    if (!wk.length) return { recovery: 0, hrv: 0, sleep: 0 };
    const recovery = wk.reduce((s, x) => s + x.recovery_score, 0) / wk.length;
    const hrv =
      wk.filter((x) => x.hrv != null).reduce((s, x) => s + (x.hrv as number), 0) /
      Math.max(1, wk.filter((x) => x.hrv != null).length);
    const sleep =
      wk.filter((x) => x.sleep_hours != null).reduce((s, x) => s + (x.sleep_hours as number), 0) /
      Math.max(1, wk.filter((x) => x.sleep_hours != null).length);
    return { recovery, hrv, sleep };
  }, [sorted]);

  const refeedAlert = useMemo(() => {
    const desc = [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    if (desc.length < 2) return false;
    const [a, b] = desc;
    const diff = Math.abs(differenceInCalendarDays(parseISO(a.date), parseISO(b.date)));
    if (diff !== 1) return false;
    return a.recovery_score < 40 && b.recovery_score < 40;
  }, [rows]);

  async function saveWhoop() {
    setMsg(null);
    const body = {
      date,
      recovery_score: Number(recovery),
      hrv: hrv ? Number(hrv) : null,
      resting_hr: rhr ? Number(rhr) : null,
      sleep_hours: sleepH ? Number(sleepH) : null,
      sleep_score: sleepScore ? Number(sleepScore) : null,
      strain: strain ? Number(strain) : null,
      notes: notes || null,
    };
    const res = await fetch("/api/whoop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (res.ok && j.ok) {
      await load();
      setMsg("Entrée WHOOP enregistrée");
      return;
    }
    const all = localStore.getWhoop() as WhoopRow[];
    const id = nextLocalId(all);
    const row: WhoopRow = {
      id,
      date,
      recovery_score: body.recovery_score,
      hrv: body.hrv,
      resting_hr: body.resting_hr,
      sleep_hours: body.sleep_hours,
      sleep_score: body.sleep_score,
      strain: body.strain,
      notes: body.notes,
    };
    localStore.setWhoop([row, ...all.filter((x) => x.date !== date)]);
    await load();
    setMsg("Enregistré en local");
  }

  const coach = coachingCard(Number(recovery) || 0);
  const coachBorder =
    coach.tone === "green"
      ? "border-t-shred-accent3"
      : coach.tone === "yellow"
        ? "border-t-shred-accent"
        : "border-t-shred-accent2";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl tracking-[0.08em]">WHOOP + coaching</h1>
        <p className="text-shred-muted mt-2">Saisie manuelle le matin — la récupération pilote le plan du jour.</p>
      </header>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-shred border border-shred-border bg-shred-surface p-4 space-y-3">
          <h2 className="font-display text-2xl tracking-wide">Saisie WHOOP du jour</h2>
          <div className="grid sm:grid-cols-2 gap-3">
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
              Récupération %
              <input
                type="number"
                value={recovery}
                onChange={(e) => setRecovery(e.target.value)}
                className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
              />
            </label>
            <label className="text-xs font-mono text-shred-muted block">
              VFC (ms)
              <input
                type="number"
                value={hrv}
                onChange={(e) => setHrv(e.target.value)}
                className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
              />
            </label>
            <label className="text-xs font-mono text-shred-muted block">
              FC repos (bpm)
              <input
                type="number"
                value={rhr}
                onChange={(e) => setRhr(e.target.value)}
                className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
              />
            </label>
            <label className="text-xs font-mono text-shred-muted block">
              Sommeil (heures)
              <input
                type="number"
                step="0.1"
                value={sleepH}
                onChange={(e) => setSleepH(e.target.value)}
                className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
              />
            </label>
            <label className="text-xs font-mono text-shred-muted block">
              Qualité du sommeil %
              <input
                type="number"
                value={sleepScore}
                onChange={(e) => setSleepScore(e.target.value)}
                className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
              />
            </label>
            <label className="text-xs font-mono text-shred-muted block">
              Strain veille (0–21)
              <input
                type="number"
                step="0.1"
                value={strain}
                onChange={(e) => setStrain(e.target.value)}
                className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2"
              />
            </label>
            <label className="text-xs font-mono text-shred-muted sm:col-span-2 block">
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
            onClick={() => void saveWhoop()}
            className="rounded-shred border border-shred-accent bg-shred-accent px-4 py-2 font-mono text-sm text-shred-bg"
          >
            Enregistrer
          </button>
          {msg ? <p className="font-mono text-xs text-shred-accent3">{msg}</p> : null}
        </div>

        <div className={`rounded-shred border border-shred-border bg-shred-surface2 p-4 border-t-4 ${coachBorder}`}>
          <h3 className="font-display text-2xl tracking-wide">{coach.title}</h3>
          <p className="text-sm text-shred-muted mt-3 leading-relaxed">{coach.body}</p>
          <p className="mt-4 font-mono text-xs text-shred-muted">
            Aperçu basé sur la récupération saisie ci-dessus ({recovery}%) avant enregistrement — l&apos;historique
            alimente les graphiques.
          </p>
        </div>
      </section>

      {refeedAlert ? (
        <div className="rounded-shred border border-shred-accent2 bg-shred-surface p-4 border-t-4 border-t-shred-accent2 font-mono text-sm text-shred-accent2">
          ⚠ Envisage un refeed glucides ce soir (+50 g) — récupération sous 40 % deux jours d&apos;affilée.
        </div>
      ) : null}

      <section className="rounded-shred border border-shred-border bg-shred-surface p-4">
        <h2 className="font-display text-xl mb-2">VFC — 7 derniers jours</h2>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={last7}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222228" />
              <XAxis dataKey="date" tick={{ fill: "#666670", fontSize: 11 }} />
              <YAxis tick={{ fill: "#666670", fontSize: 11 }} width={36} />
              <Tooltip
                contentStyle={{
                  background: "#111114",
                  border: "1px solid #222228",
                  borderRadius: 12,
                  color: "#f0f0f0",
                }}
              />
              <Line type="monotone" dataKey="hrv" stroke="#3bffd4" strokeWidth={2} dot={{ r: 3, fill: "#e8ff3b" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-shred-muted mt-2 font-mono">
          Sommeil moyen (7 jours glissants) : {weekAvg.sleep ? weekAvg.sleep.toFixed(1) : "—"} h
        </p>
      </section>

      <section className="rounded-shred border border-shred-border bg-shred-surface2 p-4">
        <h2 className="font-display text-xl mb-2">Résumé hebdomadaire (7 derniers jours de données)</h2>
        <div className="grid sm:grid-cols-3 gap-3 font-mono text-sm">
          <div className="rounded-shred border border-shred-border p-3 bg-shred-surface">
            <p className="text-shred-muted text-xs">Récup. moy.</p>
            <p className="text-2xl text-shred-accent3 mt-1">{weekAvg.recovery ? weekAvg.recovery.toFixed(0) : "—"}%</p>
          </div>
          <div className="rounded-shred border border-shred-border p-3 bg-shred-surface">
            <p className="text-shred-muted text-xs">VFC moy.</p>
            <p className="text-2xl text-shred-accent mt-1">{weekAvg.hrv ? weekAvg.hrv.toFixed(0) : "—"} ms</p>
          </div>
          <div className="rounded-shred border border-shred-border p-3 bg-shred-surface">
            <p className="text-shred-muted text-xs">Sommeil moy.</p>
            <p className="text-2xl text-shred-text mt-1">{weekAvg.sleep ? weekAvg.sleep.toFixed(1) : "—"} h</p>
          </div>
        </div>
      </section>

      <section className="rounded-shred border border-shred-border bg-shred-surface overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-shred-surface2 font-mono text-xs uppercase text-shred-muted">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Récup.</th>
              <th className="px-3 py-2">VFC</th>
              <th className="px-3 py-2">FC repos</th>
              <th className="px-3 py-2">Sommeil h</th>
              <th className="px-3 py-2">Sommeil %</th>
              <th className="px-3 py-2">Strain</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].sort((a, b) => (a.date < b.date ? 1 : -1)).map((r) => {
              const c =
                r.recovery_score >= 67
                  ? "text-shred-accent3"
                  : r.recovery_score >= 34
                    ? "text-shred-accent"
                    : "text-shred-accent2";
              return (
                <tr key={r.id} className="border-t border-shred-border">
                  <td className="px-3 py-2 font-mono">{r.date}</td>
                  <td className={`px-3 py-2 font-mono ${c}`}>{r.recovery_score}%</td>
                  <td className="px-3 py-2 font-mono text-shred-muted">{r.hrv ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-shred-muted">{r.resting_hr ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-shred-muted">{r.sleep_hours ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-shred-muted">{r.sleep_score ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-shred-muted">{r.strain ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
