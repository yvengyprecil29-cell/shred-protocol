import { NextResponse } from "next/server";
import { getDb, getDbError } from "@/lib/db";
import type { WorkoutLogRow } from "@/lib/types";

export const dynamic = "force-dynamic";

function noDb() {
  return NextResponse.json(
    { ok: false, useLocal: true, error: getDbError()?.message ?? "Database unavailable" },
    { status: 503 },
  );
}

export async function GET(req: Request) {
  const db = getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  const date = searchParams.get("date");
  const exercise = searchParams.get("exercise");
  const type = searchParams.get("type");

  if (exercise && type) {
    const rows = db
      .prepare(
        `SELECT wl.* FROM workout_logs wl
         JOIN sessions s ON s.id = wl.session_id
         WHERE wl.exercise_name = ? AND s.type = ?
         ORDER BY wl.date ASC, wl.set_number ASC`,
      )
      .all(exercise, type) as WorkoutLogRow[];
    return NextResponse.json({ ok: true, data: rows });
  }

  if (sessionId && date) {
    const rows = db
      .prepare(
        `SELECT * FROM workout_logs WHERE session_id = ? AND date = ? ORDER BY exercise_name, set_number`,
      )
      .all(Number(sessionId), date) as WorkoutLogRow[];
    return NextResponse.json({ ok: true, data: rows });
  }

  if (sessionId) {
    const rows = db
      .prepare(`SELECT * FROM workout_logs WHERE session_id = ? ORDER BY date DESC, exercise_name, set_number`)
      .all(Number(sessionId)) as WorkoutLogRow[];
    return NextResponse.json({ ok: true, data: rows });
  }

  const rows = db
    .prepare(`SELECT * FROM workout_logs ORDER BY date DESC, exercise_name, set_number`)
    .all() as WorkoutLogRow[];
  return NextResponse.json({ ok: true, data: rows });
}

type RowInput = {
  exercise_name: string;
  set_number: number;
  weight_kg: number;
  reps_done: string;
  rpe?: number | null;
  notes?: string | null;
};

type Body = {
  session_id: number;
  date: string;
  rows: RowInput[];
};

export async function POST(req: Request) {
  const db = getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Body;
  if (!body?.session_id || !body?.date || !Array.isArray(body.rows)) {
    return NextResponse.json({ ok: false, error: "session_id, date, rows required" }, { status: 400 });
  }
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM workout_logs WHERE session_id = ? AND date = ?`).run(body.session_id, body.date);
    const ins = db.prepare(
      `INSERT INTO workout_logs (session_id, date, exercise_name, set_number, weight_kg, reps_done, rpe, notes)
       VALUES (?,?,?,?,?,?,?,?)`,
    );
    for (const row of body.rows) {
      ins.run(
        body.session_id,
        body.date,
        row.exercise_name,
        row.set_number,
        row.weight_kg,
        row.reps_done,
        row.rpe ?? null,
        row.notes ?? null,
      );
    }
  });
  tx();
  const rows = db
    .prepare(`SELECT * FROM workout_logs WHERE session_id = ? AND date = ? ORDER BY exercise_name, set_number`)
    .all(body.session_id, body.date) as WorkoutLogRow[];
  return NextResponse.json({ ok: true, data: rows });
}
