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
  const db = getDb();
  if (!db) return noDb();
  const rows = db.prepare(`SELECT * FROM fast_walks ORDER BY date DESC, id DESC`).all() as FastWalkRow[];
  return NextResponse.json({ ok: true, data: rows });
}

type Body = {
  session_id: number;
  date: string;
  duration_minutes: number;
  distance_km?: number | null;
  notes?: string | null;
};

export async function POST(req: Request) {
  const db = getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Body;
  if (!body?.session_id || !body?.date || body.duration_minutes == null) {
    return NextResponse.json(
      { ok: false, error: "session_id, date, duration_minutes required" },
      { status: 400 },
    );
  }
  const r = db
    .prepare(
      `INSERT INTO fast_walks (session_id, date, duration_minutes, distance_km, notes) VALUES (?,?,?,?,?)`,
    )
    .run(body.session_id, body.date, body.duration_minutes, body.distance_km ?? null, body.notes ?? null);
  const row = db.prepare(`SELECT * FROM fast_walks WHERE id = ?`).get(Number(r.lastInsertRowid)) as FastWalkRow;
  return NextResponse.json({ ok: true, data: row });
}

export async function DELETE(req: Request) {
  const db = getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  db.prepare(`DELETE FROM fast_walks WHERE id = ?`).run(Number(id));
  return NextResponse.json({ ok: true });
}
