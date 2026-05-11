import { NextResponse } from "next/server";
import { getDb, getDbError } from "@/lib/db";
import type { ExerciseRow, SessionRow } from "@/lib/types";

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
  const templateOnly = searchParams.get("template") === "1";
  const sql = templateOnly
    ? `SELECT * FROM sessions WHERE template = 1 ORDER BY id DESC`
    : `SELECT * FROM sessions ORDER BY id DESC`;
  const sessionsResult = await db.execute(sql);
  const rows = sessionsResult.rows as unknown as SessionRow[];
  const withEx = await Promise.all(
    rows.map(async (s) => {
      const exResult = await db.execute({
        sql: `SELECT * FROM exercises WHERE session_id = ? ORDER BY order_index ASC, id ASC`,
        args: [s.id],
      });
      return { ...s, exercises: exResult.rows as unknown as ExerciseRow[] };
    }),
  );
  return NextResponse.json({ ok: true, data: withEx });
}

type ExInput = {
  name: string;
  sets?: number;
  reps_target?: string;
  rest_seconds?: number;
  order_index?: number;
  notes?: string | null;
};

type Body = {
  name: string;
  type: string;
  date?: string | null;
  template?: boolean | number;
  notes?: string | null;
  exercises?: ExInput[];
};

export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Body;
  if (!body?.name || !body?.type) {
    return NextResponse.json({ ok: false, error: "name and type required" }, { status: 400 });
  }
  const template = body.template === true || body.template === 1 ? 1 : 0;
  const insertResult = await db.execute({
    sql: `INSERT INTO sessions (name, type, date, template, notes) VALUES (?,?,?,?,?)`,
    args: [body.name, body.type, body.date ?? null, template, body.notes ?? null],
  });
  const sessionId = Number(insertResult.lastInsertRowid);
  if (Array.isArray(body.exercises) && body.exercises.length > 0) {
    const exStmts = body.exercises
      .filter((e) => e?.name)
      .map((e, i) => ({
        sql: `INSERT INTO exercises (session_id, name, sets, reps_target, rest_seconds, order_index, notes) VALUES (?,?,?,?,?,?,?)`,
        args: [sessionId, e.name, e.sets ?? 3, e.reps_target ?? "8-10", e.rest_seconds ?? 90, e.order_index ?? i, e.notes ?? null] as (string | number | null)[],
      }));
    if (exStmts.length > 0) await db.batch(exStmts, "write");
  }
  const sessionResult = await db.execute({ sql: `SELECT * FROM sessions WHERE id = ?`, args: [sessionId] });
  const exResult = await db.execute({ sql: `SELECT * FROM exercises WHERE session_id = ? ORDER BY order_index ASC`, args: [sessionId] });
  return NextResponse.json({ ok: true, data: { ...(sessionResult.rows[0] as unknown as SessionRow), exercises: exResult.rows as unknown as ExerciseRow[] } });
}

export async function PUT(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Body & { id: number };
  if (!body?.id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const template = body.template === true || body.template === 1 ? 1 : 0;
  const stmts: { sql: string; args: (string | number | null)[] }[] = [
    {
      sql: `UPDATE sessions SET name=?, type=?, date=?, template=?, notes=? WHERE id=?`,
      args: [body.name, body.type, body.date ?? null, template, body.notes ?? null, body.id],
    },
  ];
  if (Array.isArray(body.exercises)) {
    stmts.push({ sql: `DELETE FROM exercises WHERE session_id = ?`, args: [body.id] });
    body.exercises.filter((e) => e?.name).forEach((e, i) => {
      stmts.push({
        sql: `INSERT INTO exercises (session_id, name, sets, reps_target, rest_seconds, order_index, notes) VALUES (?,?,?,?,?,?,?)`,
        args: [body.id, e.name, e.sets ?? 3, e.reps_target ?? "8-10", e.rest_seconds ?? 90, e.order_index ?? i, e.notes ?? null],
      });
    });
  }
  await db.batch(stmts, "write");
  const sessionResult = await db.execute({ sql: `SELECT * FROM sessions WHERE id = ?`, args: [body.id] });
  const exResult = await db.execute({ sql: `SELECT * FROM exercises WHERE session_id = ? ORDER BY order_index ASC`, args: [body.id] });
  return NextResponse.json({ ok: true, data: { ...(sessionResult.rows[0] as unknown as SessionRow), exercises: exResult.rows as unknown as ExerciseRow[] } });
}

export async function DELETE(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await db.execute({ sql: `DELETE FROM sessions WHERE id = ?`, args: [Number(id)] });
  return NextResponse.json({ ok: true });
}
