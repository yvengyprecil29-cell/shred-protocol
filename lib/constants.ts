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
  supplementNote: "Créatine 5 g/jour, uniquement après l'entraînement",
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

/** Libellés UI (les valeurs en base restent en anglais) */
export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  PUSH: "Poussée",
  PULL: "Tirage",
  LEGS: "Jambes",
  CARDIO: "Cardio",
  OTHER: "Autre",
};

export const WEEKLY_SPLIT = [
  { day: "Lundi", label: "PUSH A", detail: "Pectoraux · Épaules · Triceps" },
  { day: "Mardi", label: "PULL A", detail: "Dos · Biceps" },
  { day: "Mercredi", label: "LEGS", detail: "Quadriceps · Ischio-jambiers · Mollets" },
  { day: "Jeudi", label: "PUSH B", detail: "Épaules · Triceps · Pectoraux" },
  { day: "Vendredi", label: "PULL B", detail: "Dos · Biceps · Deltoïdes postérieurs" },
  { day: "Samedi", label: "REPOS", detail: "Récupération" },
  { day: "Dimanche", label: "REPOS", detail: "Récupération" },
] as const;
