import { NextResponse } from "next/server";
import { getDb, getDbError } from "@/lib/db";
import type { DailyLog, FoodItem } from "@/lib/types";

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
  const logsResult = await db.execute(`SELECT * FROM daily_logs ORDER BY date DESC`);
  const logs = logsResult.rows as unknown as DailyLog[];
  const withFood = await Promise.all(
    logs.map(async (log) => {
      const foodResult = await db.execute({
        sql: `SELECT * FROM food_items WHERE log_id = ? ORDER BY id ASC`,
        args: [log.id],
      });
      return { ...log, food_items: foodResult.rows as unknown as FoodItem[] };
    }),
  );
  return NextResponse.json({ ok: true, data: withFood });
}

type Body = {
  date: string;
  weight?: number | null;
  body_fat?: number | null;
  day_type?: string;
  session_id?: number | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  water?: number | null;
  creatine?: boolean | number;
  notes?: string | null;
  food_items?: Partial<FoodItem>[];
};

export async function POST(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Body;
  if (!body?.date) return NextResponse.json({ ok: false, error: "date required" }, { status: 400 });

  const dayType = body.day_type === "rest" ? "rest" : "training";
  const creatine = body.creatine === true || body.creatine === 1 ? 1 : 0;

  const existResult = await db.execute({ sql: `SELECT id FROM daily_logs WHERE date = ?`, args: [body.date] });
  const existing = existResult.rows[0] as unknown as { id: number } | undefined;

  let logId: number;

  if (existing) {
    logId = Number(existing.id);
    const stmts: { sql: string; args: (string | number | null)[] }[] = [
      {
        sql: `UPDATE daily_logs SET weight=?, body_fat=?, day_type=?, session_id=?, calories=?, protein=?, carbs=?, fat=?, water=?, creatine=?, notes=? WHERE id=?`,
        args: [body.weight ?? null, body.body_fat ?? null, dayType, body.session_id ?? null, body.calories ?? null, body.protein ?? null, body.carbs ?? null, body.fat ?? null, body.water ?? null, creatine, body.notes ?? null, logId],
      },
    ];
    if (Array.isArray(body.food_items)) {
      stmts.push({ sql: `DELETE FROM food_items WHERE log_id = ?`, args: [logId] });
      for (const f of body.food_items) {
        if (!f?.name) continue;
        stmts.push({
          sql: `INSERT INTO food_items (log_id, name, quantity, unit, calories, protein, carbs, fat) VALUES (?,?,?,?,?,?,?,?)`,
          args: [logId, f.name, f.quantity ?? null, f.unit ?? null, f.calories ?? null, f.protein ?? null, f.carbs ?? null, f.fat ?? null],
        });
      }
    }
    await db.batch(stmts, "write");
  } else {
    const insertResult = await db.execute({
      sql: `INSERT INTO daily_logs (date, weight, body_fat, day_type, session_id, calories, protein, carbs, fat, water, creatine, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [body.date, body.weight ?? null, body.body_fat ?? null, dayType, body.session_id ?? null, body.calories ?? null, body.protein ?? null, body.carbs ?? null, body.fat ?? null, body.water ?? null, creatine, body.notes ?? null],
    });
    logId = Number(insertResult.lastInsertRowid);
    if (Array.isArray(body.food_items) && body.food_items.length > 0) {
      const foodStmts = body.food_items
        .filter((f) => f?.name)
        .map((f) => ({
          sql: `INSERT INTO food_items (log_id, name, quantity, unit, calories, protein, carbs, fat) VALUES (?,?,?,?,?,?,?,?)`,
          args: [logId, f.name!, f.quantity ?? null, f.unit ?? null, f.calories ?? null, f.protein ?? null, f.carbs ?? null, f.fat ?? null] as (string | number | null)[],
        }));
      if (foodStmts.length > 0) await db.batch(foodStmts, "write");
    }
  }

  const rowResult = await db.execute({ sql: `SELECT * FROM daily_logs WHERE id = ?`, args: [logId] });
  const foodResult = await db.execute({ sql: `SELECT * FROM food_items WHERE log_id = ? ORDER BY id ASC`, args: [logId] });
  return NextResponse.json({ ok: true, data: { ...(rowResult.rows[0] as unknown as DailyLog), food_items: foodResult.rows as unknown as FoodItem[] } });
}

export async function DELETE(req: Request) {
  const db = await getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const lid = Number(id);
  await db.batch([
    { sql: `DELETE FROM food_items WHERE log_id = ?`, args: [lid] },
    { sql: `DELETE FROM daily_logs WHERE id = ?`, args: [lid] },
  ], "write");
  return NextResponse.json({ ok: true });
}
