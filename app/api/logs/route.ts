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
  const db = getDb();
  if (!db) return noDb();
  const logs = db.prepare(`SELECT * FROM daily_logs ORDER BY date DESC`).all() as DailyLog[];
  const foodStmt = db.prepare(`SELECT * FROM food_items WHERE log_id = ? ORDER BY id ASC`);
  const withFood = logs.map((log) => ({
    ...log,
    food_items: foodStmt.all(log.id) as FoodItem[],
  }));
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
  const db = getDb();
  if (!db) return noDb();
  const body = (await req.json()) as Body;
  if (!body?.date) {
    return NextResponse.json({ ok: false, error: "date required" }, { status: 400 });
  }
  const dayType = body.day_type === "rest" ? "rest" : "training";
  const creatine = body.creatine === true || body.creatine === 1 ? 1 : 0;

  const existing = db.prepare(`SELECT id FROM daily_logs WHERE date = ?`).get(body.date) as
    | { id: number }
    | undefined;

  const tx = db.transaction(() => {
    if (existing) {
      db.prepare(
        `UPDATE daily_logs SET weight=?, body_fat=?, day_type=?, session_id=?, calories=?, protein=?, carbs=?, fat=?, water=?, creatine=?, notes=?
         WHERE id=?`,
      ).run(
        body.weight ?? null,
        body.body_fat ?? null,
        dayType,
        body.session_id ?? null,
        body.calories ?? null,
        body.protein ?? null,
        body.carbs ?? null,
        body.fat ?? null,
        body.water ?? null,
        creatine,
        body.notes ?? null,
        existing.id,
      );
      if (Array.isArray(body.food_items)) {
        db.prepare(`DELETE FROM food_items WHERE log_id = ?`).run(existing.id);
        const ins = db.prepare(
          `INSERT INTO food_items (log_id, name, quantity, unit, calories, protein, carbs, fat) VALUES (?,?,?,?,?,?,?,?)`,
        );
        for (const f of body.food_items) {
          if (!f?.name) continue;
          ins.run(
            existing.id,
            f.name,
            f.quantity ?? null,
            f.unit ?? null,
            f.calories ?? null,
            f.protein ?? null,
            f.carbs ?? null,
            f.fat ?? null,
          );
        }
      }
      return existing.id;
    }
    const r = db
      .prepare(
        `INSERT INTO daily_logs (date, weight, body_fat, day_type, session_id, calories, protein, carbs, fat, water, creatine, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        body.date,
        body.weight ?? null,
        body.body_fat ?? null,
        dayType,
        body.session_id ?? null,
        body.calories ?? null,
        body.protein ?? null,
        body.carbs ?? null,
        body.fat ?? null,
        body.water ?? null,
        creatine,
        body.notes ?? null,
      );
    const logId = Number(r.lastInsertRowid);
    if (Array.isArray(body.food_items)) {
      const ins = db.prepare(
        `INSERT INTO food_items (log_id, name, quantity, unit, calories, protein, carbs, fat) VALUES (?,?,?,?,?,?,?,?)`,
      );
      for (const f of body.food_items) {
        if (!f?.name) continue;
        ins.run(
          logId,
          f.name,
          f.quantity ?? null,
          f.unit ?? null,
          f.calories ?? null,
          f.protein ?? null,
          f.carbs ?? null,
          f.fat ?? null,
        );
      }
    }
    return logId;
  });

  const id = tx();
  const row = db.prepare(`SELECT * FROM daily_logs WHERE id = ?`).get(id) as DailyLog;
  const food = db.prepare(`SELECT * FROM food_items WHERE log_id = ? ORDER BY id ASC`).all(id) as FoodItem[];
  return NextResponse.json({ ok: true, data: { ...row, food_items: food } });
}

export async function DELETE(req: Request) {
  const db = getDb();
  if (!db) return noDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  db.prepare(`DELETE FROM daily_logs WHERE id = ?`).run(Number(id));
  return NextResponse.json({ ok: true });
}
