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
  const db = getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  if (searchParams.get("names") === "1") {
    const rows = db
      .prepare(`SELECT DISTINCT name FROM exercises ORDER BY name COLLATE NOCASE ASC`)
      .all() as { name: string }[];
    return NextResponse.json({ ok: true, data: rows.map((r) => r.name) });
  }
  const sessionId = searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "session_id or names=1 required" }, { status: 400 });
  }
  const exercises = db
    .prepare(`SELECT * FROM exercises WHERE session_id = ? ORDER BY order_index ASC, id ASC`)
    .all(Number(sessionId)) as ExerciseRow[];
  return NextResponse.json({ ok: true, data: exercises });
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
  const db = getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Body;
  if (!body?.session_id || !body?.name) {
    return NextResponse.json({ ok: false, error: "session_id and name required" }, { status: 400 });
  }
  const r = db
    .prepare(
      `INSERT INTO exercises (session_id, name, sets, reps_target, rest_seconds, order_index, notes) VALUES (?,?,?,?,?,?,?)`,
    )
    .run(
      body.session_id,
      body.name,
      body.sets ?? 3,
      body.reps_target ?? "8-10",
      body.rest_seconds ?? 90,
      body.order_index ?? 0,
      body.notes ?? null,
    );
  const row = db.prepare(`SELECT * FROM exercises WHERE id = ?`).get(Number(r.lastInsertRowid)) as ExerciseRow;
  return NextResponse.json({ ok: true, data: row });
}

export async function PUT(req: Request) {
  const db = getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Partial<ExerciseRow> & { id: number };
  if (!body?.id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const cur = db.prepare(`SELECT * FROM exercises WHERE id = ?`).get(body.id) as ExerciseRow | undefined;
  if (!cur) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  db.prepare(
    `UPDATE exercises SET name=?, sets=?, reps_target=?, rest_seconds=?, order_index=?, notes=? WHERE id=?`,
  ).run(
    body.name ?? cur.name,
    body.sets ?? cur.sets,
    body.reps_target ?? cur.reps_target,
    body.rest_seconds ?? cur.rest_seconds,
    body.order_index ?? cur.order_index,
    body.notes !== undefined ? body.notes : cur.notes,
    body.id,
  );
  const row = db.prepare(`SELECT * FROM exercises WHERE id = ?`).get(body.id) as ExerciseRow;
  return NextResponse.json({ ok: true, data: row });
}

export async function DELETE(req: Request) {
  const db = getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  db.prepare(`DELETE FROM exercises WHERE id = ?`).run(Number(id));
  return NextResponse.json({ ok: true });
}
