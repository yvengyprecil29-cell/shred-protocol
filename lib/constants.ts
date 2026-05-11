export const USER = {
  name: "Yvengy",
  startDate: "2026-05-11",
  startWeightKg: 106.6,
  bodyFatPct: 18,
  leanMassKg: 87.4,
  goalWeightKg: 99,
  goalBodyFatPctLow: 12,
  goalBodyFatPctHigh: 13,
  goalEndDate: "2026-08-31",
  trainingDaysPerWeek: 5,
  supplementNote: "Creatine 5g/day post-workout only",
} as const;

export const PROGRAM_WEEKS = 11;

export const MACRO_TRAINING = {
  calories: 2250,
  protein: 210,
  carbs: 150,
  fat: 100,
} as const;

export const MACRO_REST = {
  calories: 2100,
  protein: 210,
  carbs: 100,
  fat: 100,
} as const;

export const PROTEIN_OK_THRESHOLD = 200;

export const SESSION_TYPES = ["PUSH", "PULL", "LEGS", "CARDIO", "OTHER"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const WEEKLY_SPLIT = [
  { day: "Monday", label: "PUSH A", detail: "Chest · Shoulders · Triceps" },
  { day: "Tuesday", label: "PULL A", detail: "Back · Biceps" },
  { day: "Wednesday", label: "LEGS", detail: "Quads · Hamstrings · Calves" },
  { day: "Thursday", label: "PUSH B", detail: "Shoulders · Triceps · Chest" },
  { day: "Friday", label: "PULL B", detail: "Back · Biceps · Rear delts" },
  { day: "Saturday", label: "REST", detail: "Recovery" },
  { day: "Sunday", label: "REST", detail: "Recovery" },
] as const;
