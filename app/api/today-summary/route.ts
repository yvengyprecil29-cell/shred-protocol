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

  // Step 1: find session_ids in workout_logs for this date
  const wlResult = await db.execute({
    sql: `SELECT DISTINCT session_id FROM workout_logs WHERE date = ?`,
    args: [date],
  });
  const sessionIds = wlResult.rows.map((r) => Number((r as unknown as { session_id: number }).session_id));

  // Step 2: fetch matching non-template sessions
  let sessionsResult: { rows: unknown[] } = { rows: [] };
  if (sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => "?").join(",");
    sessionsResult = await db.execute({
      sql: `SELECT id, name, type FROM sessions WHERE id IN (${placeholders}) AND (template = 0 OR template IS NULL)`,
      args: sessionIds,
    });
  }

  // Most recent walk for this date
  const walkResult = await db.execute({
    sql: `SELECT duration_minutes, distance_km, speed_kmh, incline_percent FROM fast_walks WHERE date = ? ORDER BY id DESC LIMIT 1`,
    args: [date],
  });

  // Food totals — 2-step to avoid JOIN issues in serverless
  type MealRow = { meal: string | null; calories: number; protein: number; carbs: number; fat: number };
  let byMeal: MealRow[] = [];
  const logForDate = await db.execute({ sql: `SELECT id FROM daily_logs WHERE date = ?`, args: [date] });
  if (logForDate.rows.length > 0) {
    const logId = Number((logForDate.rows[0] as unknown as { id: number }).id);
    const byMealResult = await db.execute({
      sql: `SELECT meal,
                   COALESCE(SUM(calories), 0) as calories,
                   COALESCE(SUM(protein), 0)  as protein,
                   COALESCE(SUM(carbs), 0)    as carbs,
                   COALESCE(SUM(fat), 0)       as fat
            FROM food_items
            WHERE log_id = ?
            GROUP BY meal
            ORDER BY meal`,
      args: [logId],
    });
    byMeal = byMealResult.rows as unknown as MealRow[];
  }

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
