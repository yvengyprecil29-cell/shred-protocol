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
  const db = getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const templateOnly = searchParams.get("template") === "1";
  let rows: SessionRow[];
  if (templateOnly) {
    rows = db.prepare(`SELECT * FROM sessions WHERE template = 1 ORDER BY id DESC`).all() as SessionRow[];
  } else {
    rows = db.prepare(`SELECT * FROM sessions ORDER BY id DESC`).all() as SessionRow[];
  }
  const exStmt = db.prepare(`SELECT * FROM exercises WHERE session_id = ? ORDER BY order_index ASC, id ASC`);
  const withEx = rows.map((s) => ({
    ...s,
    exercises: exStmt.all(s.id) as ExerciseRow[],
  }));
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
  const db = getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Body;
  if (!body?.name || !body?.type) {
    return NextResponse.json({ ok: false, error: "name and type required" }, { status: 400 });
  }
  const template = body.template === true || body.template === 1 ? 1 : 0;
  const tx = db.transaction(() => {
    const r = db
      .prepare(
        `INSERT INTO sessions (name, type, date, template, notes) VALUES (?,?,?,?,?)`,
      )
      .run(body.name, body.type, body.date ?? null, template, body.notes ?? null);
    const sid = Number(r.lastInsertRowid);
    if (Array.isArray(body.exercises)) {
      const ins = db.prepare(
        `INSERT INTO exercises (session_id, name, sets, reps_target, rest_seconds, order_index, notes) VALUES (?,?,?,?,?,?,?)`,
      );
      body.exercises.forEach((e, i) => {
        if (!e?.name) return;
        ins.run(
          sid,
          e.name,
          e.sets ?? 3,
          e.reps_target ?? "8-10",
          e.rest_seconds ?? 90,
          e.order_index ?? i,
          e.notes ?? null,
        );
      });
    }
    return sid;
  });
  const sessionId = tx();
  const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) as SessionRow;
  const exercises = db
    .prepare(`SELECT * FROM exercises WHERE session_id = ? ORDER BY order_index ASC`)
    .all(sessionId) as ExerciseRow[];
  return NextResponse.json({ ok: true, data: { ...session, exercises } });
}

export async function PUT(req: Request) {
  const db = getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Body & { id: number };
  if (!body?.id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const template = body.template === true || body.template === 1 ? 1 : 0;
  db.prepare(
    `UPDATE sessions SET name=?, type=?, date=?, template=?, notes=? WHERE id=?`,
  ).run(body.name, body.type, body.date ?? null, template, body.notes ?? null, body.id);

  if (Array.isArray(body.exercises)) {
    db.prepare(`DELETE FROM exercises WHERE session_id = ?`).run(body.id);
    const ins = db.prepare(
      `INSERT INTO exercises (session_id, name, sets, reps_target, rest_seconds, order_index, notes) VALUES (?,?,?,?,?,?,?)`,
    );
    body.exercises.forEach((e, i) => {
      if (!e?.name) return;
      ins.run(
        body.id,
        e.name,
        e.sets ?? 3,
        e.reps_target ?? "8-10",
        e.rest_seconds ?? 90,
        e.order_index ?? i,
        e.notes ?? null,
      );
    });
  }
  const session = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(body.id) as SessionRow;
  const exercises = db
    .prepare(`SELECT * FROM exercises WHERE session_id = ? ORDER BY order_index ASC`)
    .all(body.id) as ExerciseRow[];
  return NextResponse.json({ ok: true, data: { ...session, exercises } });
}

export async function DELETE(req: Request) {
  const db = getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(Number(id));
  return NextResponse.json({ ok: true });
}
