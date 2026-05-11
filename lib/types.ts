import type { SessionType } from "./constants";

export type DayType = "training" | "rest";

export interface DailyLog {
  id: number;
  date: string;
  weight: number | null;
  body_fat: number | null;
  day_type: DayType;
  session_id: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  water: number | null;
  creatine: number;
  notes: string | null;
}

export interface FoodItem {
  id: number;
  log_id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface SessionRow {
  id: number;
  name: string;
  type: SessionType | string;
  date: string | null;
  template: number;
  notes: string | null;
}

export interface ExerciseRow {
  id: number;
  session_id: number;
  name: string;
  sets: number;
  reps_target: string;
  rest_seconds: number;
  order_index: number;
  notes: string | null;
}

export interface WorkoutLogRow {
  id: number;
  session_id: number;
  date: string;
  exercise_name: string;
  set_number: number;
  weight_kg: number;
  reps_done: string;
  rpe: number | null;
  notes: string | null;
}

export interface FastWalkRow {
  id: number;
  session_id: number;
  date: string;
  duration_minutes: number;
  distance_km: number | null;
  notes: string | null;
}

export interface WhoopRow {
  id: number;
  date: string;
  recovery_score: number;
  hrv: number | null;
  resting_hr: number | null;
  sleep_hours: number | null;
  sleep_score: number | null;
  strain: number | null;
  notes: string | null;
}
