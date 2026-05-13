import { NextResponse } from "next/server";
import { getDb, getDbError } from "@/lib/db";

export const dynamic = "force-dynamic";

function noDb() {
  return NextResponse.json({ ok: false, error: getDbError()?.message ?? "DB unavailable" }, { status: 503 });
}

export async function GET(req: Request) {
  const db = await getDb();
  if (!db) return noDb();

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  // Sessions with at least one workout_log for this date, templates excluded
  const sessionsResult = await db.execute({
    sql: `SELECT DISTINCT wl.session_id as id, s.name, s.type
          FROM workout_logs wl
          JOIN sessions s ON s.id = wl.session_id
          WHERE wl.date = ?
            AND (s.template = 0 OR s.template IS NULL)`,
    args: [date],
  });

  // Most recent walk for this date
  const walkResult = await db.execute({
    sql: `SELECT duration_minutes, distance_km, speed_kmh, incline_percent FROM fast_walks WHERE date = ? ORDER BY id DESC LIMIT 1`,
    args: [date],
  });

  // Food totals by meal
  const byMealResult = await db.execute({
    sql: `SELECT fi.meal,
                 COALESCE(SUM(fi.calories), 0) as calories,
                 COALESCE(SUM(fi.protein), 0)  as protein,
                 COALESCE(SUM(fi.carbs), 0)    as carbs,
                 COALESCE(SUM(fi.fat), 0)       as fat
          FROM food_items fi
          JOIN daily_logs dl ON dl.id = fi.log_id
          WHERE dl.date = ?
          GROUP BY fi.meal
          ORDER BY fi.meal`,
    args: [date],
  });

  type MealRow = { meal: string | null; calories: number; protein: number; carbs: number; fat: number };
  const byMeal = byMealResult.rows as unknown as MealRow[];

  const totalCalories = byMeal.reduce((s, m) => s + m.calories, 0);
  const totalProtein = byMeal.reduce((s, m) => s + m.protein, 0);
  const totalCarbs = byMeal.reduce((s, m) => s + m.carbs, 0);
  const totalFat = byMeal.reduce((s, m) => s + m.fat, 0);

  type SessionRow = { id: number; name: string; type: string };

  return NextResponse.json({
    ok: true,
    data: {
      date,
      sessions: sessionsResult.rows as unknown as SessionRow[],
      walk: walkResult.rows[0] ?? null,
      food_totals: {
        calories: Math.round(totalCalories * 10) / 10,
        protein: Math.round(totalProtein * 10) / 10,
        carbs: Math.round(totalCarbs * 10) / 10,
        fat: Math.round(totalFat * 10) / 10,
        by_meal: byMeal,
      },
    },
  });
}
