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
  const db = await getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  const date = searchParams.get("date");
  const exercise = searchParams.get("exercise");
  const type = searchParams.get("type");

  if (exercise && type) {
    const result = await db.execute({
      sql: `SELECT wl.* FROM workout_logs wl JOIN sessions s ON s.id = wl.session_id WHERE wl.exercise_name = ? AND s.type = ? ORDER BY wl.date ASC, wl.set_number ASC`,
      args: [exercise, type],
    });
    return NextResponse.json({ ok: true, data: result.rows as unknown as WorkoutLogRow[] });
  }
  if (sessionId && date) {
    const result = await db.execute({
      sql: `SELECT * FROM workout_logs WHERE session_id = ? AND date = ? ORDER BY exercise_name, set_number`,
      args: [Number(sessionId), date],
    });
    return NextResponse.json({ ok: true, data: result.rows as unknown as WorkoutLogRow[] });
  }
  if (sessionId) {
    const result = await db.execute({
      sql: `SELECT * FROM workout_logs WHERE session_id = ? ORDER BY date DESC, exercise_name, set_number`,
      args: [Number(sessionId)],
    });
    return NextResponse.json({ ok: true, data: result.rows as unknown as WorkoutLogRow[] });
  }
  const result = await db.execute(`SELECT * FROM workout_logs ORDER BY date DESC, exercise_name, set_number`);
  return NextResponse.json({ ok: true, data: result.rows as unknown as WorkoutLogRow[] });
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

export async function DELETE(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  const date = searchParams.get("date");
  if (!sessionId || !date) return NextResponse.json({ ok: false, error: "session_id and date required" }, { status: 400 });
  await db.batch([
    { sql: `DELETE FROM workout_logs WHERE session_id = ? AND date = ?`, args: [Number(sessionId), date] },
    { sql: `DELETE FROM fast_walks WHERE session_id = ? AND date = ?`, args: [Number(sessionId), date] },
  ], "write");
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Body;
  if (!body?.session_id || !body?.date || !Array.isArray(body.rows)) {
    return NextResponse.json({ ok: false, error: "session_id, date, rows required" }, { status: 400 });
  }
  const stmts: { sql: string; args: (string | number | null)[] }[] = [
    { sql: `DELETE FROM workout_logs WHERE session_id = ? AND date = ?`, args: [body.session_id, body.date] },
    ...body.rows.map((row) => ({
      sql: `INSERT INTO workout_logs (session_id, date, exercise_name, set_number, weight_kg, reps_done, rpe, notes) VALUES (?,?,?,?,?,?,?,?)`,
      args: [body.session_id, body.date, row.exercise_name, row.set_number, row.weight_kg, row.reps_done, row.rpe ?? null, row.notes ?? null] as (string | number | null)[],
    })),
  ];
  await db.batch(stmts, "write");
  const result = await db.execute({
    sql: `SELECT * FROM workout_logs WHERE session_id = ? AND date = ? ORDER BY exercise_name, set_number`,
    args: [body.session_id, body.date],
  });
  return NextResponse.json({ ok: true, data: result.rows as unknown as WorkoutLogRow[] });
}
