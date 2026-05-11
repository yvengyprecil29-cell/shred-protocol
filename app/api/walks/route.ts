import { NextResponse } from "next/server";
import { getDb, getDbError } from "@/lib/db";
import type { FastWalkRow } from "@/lib/types";

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
  const result = await db.execute(`SELECT * FROM fast_walks ORDER BY date DESC, id DESC`);
  return NextResponse.json({ ok: true, data: result.rows as unknown as FastWalkRow[] });
}

type Body = {
  session_id: number;
  date: string;
  duration_minutes: number;
  distance_km?: number | null;
  incline_percent?: number | null;
  speed_kmh?: number | null;
  notes?: string | null;
};

export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Body;
  if (!body?.session_id || !body?.date || body.duration_minutes == null) {
    return NextResponse.json({ ok: false, error: "session_id, date, duration_minutes required" }, { status: 400 });
  }
  const r = await db.execute({
    sql: `INSERT INTO fast_walks (session_id, date, duration_minutes, distance_km, incline_percent, speed_kmh, notes) VALUES (?,?,?,?,?,?,?)`,
    args: [body.session_id, body.date, body.duration_minutes, body.distance_km ?? null, body.incline_percent ?? null, body.speed_kmh ?? null, body.notes ?? null],
  });
  const result = await db.execute({ sql: `SELECT * FROM fast_walks WHERE id = ?`, args: [Number(r.lastInsertRowid)] });
  return NextResponse.json({ ok: true, data: result.rows[0] as unknown as FastWalkRow });
}

export async function DELETE(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await db.execute({ sql: `DELETE FROM fast_walks WHERE id = ?`, args: [Number(id)] });
  return NextResponse.json({ ok: true });
}
