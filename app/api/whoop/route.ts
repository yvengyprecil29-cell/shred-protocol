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
  const db = getDb();
  if (!db) return noDb();
  const rows = db.prepare(`SELECT * FROM whoop_data ORDER BY date DESC`).all() as WhoopRow[];
  return NextResponse.json({ ok: true, data: rows });
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
  const db = getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Body;
  if (!body?.date || body.recovery_score == null) {
    return NextResponse.json({ ok: false, error: "date and recovery_score required" }, { status: 400 });
  }
  const existing = db.prepare(`SELECT id FROM whoop_data WHERE date = ?`).get(body.date) as { id: number } | undefined;
  if (existing) {
    db.prepare(
      `UPDATE whoop_data SET recovery_score=?, hrv=?, resting_hr=?, sleep_hours=?, sleep_score=?, strain=?, notes=? WHERE id=?`,
    ).run(
      body.recovery_score,
      body.hrv ?? null,
      body.resting_hr ?? null,
      body.sleep_hours ?? null,
      body.sleep_score ?? null,
      body.strain ?? null,
      body.notes ?? null,
      existing.id,
    );
    const row = db.prepare(`SELECT * FROM whoop_data WHERE id = ?`).get(existing.id) as WhoopRow;
    return NextResponse.json({ ok: true, data: row });
  }
  const r = db
    .prepare(
      `INSERT INTO whoop_data (date, recovery_score, hrv, resting_hr, sleep_hours, sleep_score, strain, notes)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .run(
      body.date,
      body.recovery_score,
      body.hrv ?? null,
      body.resting_hr ?? null,
      body.sleep_hours ?? null,
      body.sleep_score ?? null,
      body.strain ?? null,
      body.notes ?? null,
    );
  const row = db.prepare(`SELECT * FROM whoop_data WHERE id = ?`).get(Number(r.lastInsertRowid)) as WhoopRow;
  return NextResponse.json({ ok: true, data: row });
}

export async function DELETE(req: Request) {
  const db = getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  db.prepare(`DELETE FROM whoop_data WHERE id = ?`).run(Number(id));
  return NextResponse.json({ ok: true });
}
