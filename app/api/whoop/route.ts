import { NextResponse } from "next/server";
import { getDb, getDbError } from "@/lib/db";
import type { WhoopRow } from "@/lib/types";

export const dynamic = "force-dynamic";

function noDb() {
  return NextResponse.json(
    { ok: false, useLocal: true, error: getDbError()?.message ?? "Database unavailable" },
    { status: 503 },
  );
}

export async function GET() {
  const db = await getDb();
  if (!db) return noDb();
  const result = await db.execute(`SELECT * FROM whoop_data ORDER BY date DESC`);
  return NextResponse.json({ ok: true, data: result.rows as unknown as WhoopRow[] });
}

type Body = {
  date: string;
  recovery_score: number;
  hrv?: number | null;
  resting_hr?: number | null;
  sleep_hours?: number | null;
  sleep_score?: number | null;
  strain?: number | null;
  notes?: string | null;
};

export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Body;
  if (!body?.date || body.recovery_score == null) {
    return NextResponse.json({ ok: false, error: "date and recovery_score required" }, { status: 400 });
  }
  const existResult = await db.execute({ sql: `SELECT id FROM whoop_data WHERE date = ?`, args: [body.date] });
  const existing = existResult.rows[0] as unknown as { id: number } | undefined;
  if (existing) {
    await db.execute({
      sql: `UPDATE whoop_data SET recovery_score=?, hrv=?, resting_hr=?, sleep_hours=?, sleep_score=?, strain=?, notes=? WHERE id=?`,
      args: [body.recovery_score, body.hrv ?? null, body.resting_hr ?? null, body.sleep_hours ?? null, body.sleep_score ?? null, body.strain ?? null, body.notes ?? null, existing.id],
    });
    const result = await db.execute({ sql: `SELECT * FROM whoop_data WHERE id = ?`, args: [existing.id] });
    return NextResponse.json({ ok: true, data: result.rows[0] as unknown as WhoopRow });
  }
  const r = await db.execute({
    sql: `INSERT INTO whoop_data (date, recovery_score, hrv, resting_hr, sleep_hours, sleep_score, strain, notes) VALUES (?,?,?,?,?,?,?,?)`,
    args: [body.date, body.recovery_score, body.hrv ?? null, body.resting_hr ?? null, body.sleep_hours ?? null, body.sleep_score ?? null, body.strain ?? null, body.notes ?? null],
  });
  const result = await db.execute({ sql: `SELECT * FROM whoop_data WHERE id = ?`, args: [Number(r.lastInsertRowid)] });
  return NextResponse.json({ ok: true, data: result.rows[0] as unknown as WhoopRow });
}

export async function DELETE(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await db.execute({ sql: `DELETE FROM whoop_data WHERE id = ?`, args: [Number(id)] });
  return NextResponse.json({ ok: true });
}
