import { NextResponse } from "next/server";
import { getDb, getDbError } from "@/lib/db";
import type { ExerciseRow } from "@/lib/types";

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
  if (searchParams.get("names") === "1") {
    const result = await db.execute(`SELECT DISTINCT name FROM exercises ORDER BY name COLLATE NOCASE ASC`);
    return NextResponse.json({ ok: true, data: (result.rows as unknown as { name: string }[]).map((r) => r.name) });
  }
  const sessionId = searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ ok: false, error: "session_id or names=1 required" }, { status: 400 });
  const result = await db.execute({
    sql: `SELECT * FROM exercises WHERE session_id = ? ORDER BY order_index ASC, id ASC`,
    args: [Number(sessionId)],
  });
  return NextResponse.json({ ok: true, data: result.rows as unknown as ExerciseRow[] });
}

type Body = {
  session_id: number;
  name: string;
  sets?: number;
  reps_target?: string;
  rest_seconds?: number;
  order_index?: number;
  notes?: string | null;
};

export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Body;
  if (!body?.session_id || !body?.name) {
    return NextResponse.json({ ok: false, error: "session_id and name required" }, { status: 400 });
  }
  const r = await db.execute({
    sql: `INSERT INTO exercises (session_id, name, sets, reps_target, rest_seconds, order_index, notes) VALUES (?,?,?,?,?,?,?)`,
    args: [body.session_id, body.name, body.sets ?? 3, body.reps_target ?? "8-10", body.rest_seconds ?? 90, body.order_index ?? 0, body.notes ?? null],
  });
  const result = await db.execute({ sql: `SELECT * FROM exercises WHERE id = ?`, args: [Number(r.lastInsertRowid)] });
  return NextResponse.json({ ok: true, data: result.rows[0] as unknown as ExerciseRow });
}

export async function PUT(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Partial<ExerciseRow> & { id: number };
  if (!body?.id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const curResult = await db.execute({ sql: `SELECT * FROM exercises WHERE id = ?`, args: [body.id] });
  const cur = curResult.rows[0] as unknown as ExerciseRow | undefined;
  if (!cur) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  await db.execute({
    sql: `UPDATE exercises SET name=?, sets=?, reps_target=?, rest_seconds=?, order_index=?, notes=? WHERE id=?`,
    args: [body.name ?? cur.name, body.sets ?? cur.sets, body.reps_target ?? cur.reps_target, body.rest_seconds ?? cur.rest_seconds, body.order_index ?? cur.order_index, body.notes !== undefined ? body.notes : cur.notes, body.id],
  });
  const result = await db.execute({ sql: `SELECT * FROM exercises WHERE id = ?`, args: [body.id] });
  return NextResponse.json({ ok: true, data: result.rows[0] as unknown as ExerciseRow });
}

export async function DELETE(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await db.execute({ sql: `DELETE FROM exercises WHERE id = ?`, args: [Number(id)] });
  return NextResponse.json({ ok: true });
}
