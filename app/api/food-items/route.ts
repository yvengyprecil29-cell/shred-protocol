import { NextResponse } from "next/server";
import { getDb, getDbError } from "@/lib/db";
import type { FoodItem } from "@/lib/types";

export const dynamic = "force-dynamic";

function noDb() {
  return NextResponse.json({ ok: false, error: getDbError()?.message ?? "DB unavailable" }, { status: 503 });
}

export async function GET(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ ok: false, error: "date required" }, { status: 400 });

  const logResult = await db.execute({ sql: `SELECT id FROM daily_logs WHERE date = ?`, args: [date] });
  if (logResult.rows.length === 0) return NextResponse.json({ ok: true, data: [] });

  const logId = Number((logResult.rows[0] as unknown as { id: number }).id);
  const items = await db.execute({
    sql: `SELECT * FROM food_items WHERE log_id = ? ORDER BY id ASC`,
    args: [logId],
  });
  return NextResponse.json({ ok: true, data: items.rows as unknown as FoodItem[] });
}

type FoodBody = {
  date: string;
  meal: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
};

export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const body = (await req.json()) as FoodBody;
  if (!body?.date || !body?.name) {
    return NextResponse.json({ ok: false, error: "date and name required" }, { status: 400 });
  }

  const logResult = await db.execute({ sql: `SELECT id FROM daily_logs WHERE date = ?`, args: [body.date] });
  let logId: number;

  if (logResult.rows.length === 0) {
    const ins = await db.execute({
      sql: `INSERT INTO daily_logs (date, day_type, creatine) VALUES (?, 'training', 0)`,
      args: [body.date],
    });
    logId = Number(ins.lastInsertRowid);
  } else {
    logId = Number((logResult.rows[0] as unknown as { id: number }).id);
  }

  const ins = await db.execute({
    sql: `INSERT INTO food_items (log_id, meal, name, quantity, unit, calories, protein, carbs, fat) VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [
      logId,
      body.meal ?? "meal1",
      body.name,
      body.quantity ?? null,
      body.unit ?? null,
      body.calories ?? null,
      body.protein ?? null,
      body.carbs ?? null,
      body.fat ?? null,
    ],
  });

  const row = await db.execute({
    sql: `SELECT * FROM food_items WHERE id = ?`,
    args: [Number(ins.lastInsertRowid)],
  });
  return NextResponse.json({ ok: true, data: row.rows[0] as unknown as FoodItem });
}

export async function DELETE(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await db.execute({ sql: `DELETE FROM food_items WHERE id = ?`, args: [Number(id)] });
  return NextResponse.json({ ok: true });
}
