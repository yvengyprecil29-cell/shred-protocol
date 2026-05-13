export type MuscleGroup =
  | "Pectoraux"
  | "Épaules"
  | "Triceps"
  | "Dos"
  | "Biceps"
  | "Quadriceps"
  | "Ischio-jambiers"
  | "Fessiers"
  | "Mollets"
  | "Cardio";

export interface ExerciseTemplate {
  name: string;
  muscle: MuscleGroup;
  icon: string;
  repRange: string;
  sets: number;
  rest: number;
}

export const MUSCLE_COLORS: Record<MuscleGroup, string> = {
  Pectoraux: "border-t-blue-400",
  Épaules: "border-t-purple-400",
  Triceps: "border-t-indigo-400",
  Dos: "border-t-green-400",
  Biceps: "border-t-teal-400",
  Quadriceps: "border-t-orange-400",
  "Ischio-jambiers": "border-t-amber-400",
  Fessiers: "border-t-pink-400",
  Mollets: "border-t-red-400",
  Cardio: "border-t-cyan-400",
};

export const EXERCISE_MUSCLE_MAP: Record<string, MuscleGroup> = {};

export const EXERCISE_LIBRARY: Record<"PUSH" | "PULL" | "LEGS" | "CARDIO", ExerciseTemplate[]> = {
  PUSH: [
    { name: "Développé couché barre", muscle: "Pectoraux", icon: "🏋️", repRange: "6-12", sets: 4, rest: 120 },
    { name: "Développé couché haltères", muscle: "Pectoraux", icon: "🏋️", repRange: "8-12", sets: 3, rest: 90 },
    { name: "Développé incliné haltères", muscle: "Pectoraux", icon: "🏋️", repRange: "8-12", sets: 3, rest: 90 },
    { name: "Écarté couché câble", muscle: "Pectoraux", icon: "🤸", repRange: "12-15", sets: 3, rest: 60 },
    { name: "Dips lestés", muscle: "Pectoraux", icon: "💪", repRange: "6-12", sets: 3, rest: 90 },
    { name: "Pompes", muscle: "Pectoraux", icon: "⬇️", repRange: "10-20", sets: 3, rest: 60 },
    { name: "Développé militaire barre", muscle: "Épaules", icon: "🏋️", repRange: "6-10", sets: 4, rest: 120 },
    { name: "Développé militaire haltères", muscle: "Épaules", icon: "🏋️", repRange: "8-12", sets: 3, rest: 90 },
    { name: "Élévations latérales haltères", muscle: "Épaules", icon: "↔️", repRange: "12-20", sets: 4, rest: 60 },
    { name: "Élévations latérales câble", muscle: "Épaules", icon: "↔️", repRange: "15-20", sets: 3, rest: 60 },
    { name: "Oiseau (deltoïdes postérieurs)", muscle: "Épaules", icon: "🦅", repRange: "12-20", sets: 3, rest: 60 },
    { name: "Face pull câble", muscle: "Épaules", icon: "🎯", repRange: "15-20", sets: 3, rest: 60 },
    { name: "Extension triceps poulie haute", muscle: "Triceps", icon: "⬇️", repRange: "10-15", sets: 3, rest: 60 },
    { name: "Skull crusher barre EZ", muscle: "Triceps", icon: "💀", repRange: "8-12", sets: 3, rest: 90 },
    { name: "Kick-back triceps haltère", muscle: "Triceps", icon: "↩️", repRange: "12-15", sets: 3, rest: 60 },
    { name: "Extension overhead câble", muscle: "Triceps", icon: "⬆️", repRange: "10-15", sets: 3, rest: 60 },
  ],
  PULL: [
    { name: "Tractions prise large", muscle: "Dos", icon: "🧗", repRange: "5-12", sets: 4, rest: 120 },
    { name: "Tractions prise serrée", muscle: "Dos", icon: "🧗", repRange: "6-12", sets: 3, rest: 120 },
    { name: "Tirage poulie haute prise large", muscle: "Dos", icon: "⬇️", repRange: "8-12", sets: 4, rest: 90 },
    { name: "Tirage poulie haute prise serrée", muscle: "Dos", icon: "⬇️", repRange: "10-15", sets: 3, rest: 90 },
    { name: "Tirage horizontal câble", muscle: "Dos", icon: "↩️", repRange: "8-12", sets: 3, rest: 90 },
    { name: "Row haltère unilatéral", muscle: "Dos", icon: "💪", repRange: "8-12", sets: 3, rest: 90 },
    { name: "Row barre penché", muscle: "Dos", icon: "🏋️", repRange: "6-10", sets: 4, rest: 120 },
    { name: "Soulevé de terre roumain", muscle: "Dos", icon: "🏋️", repRange: "6-10", sets: 3, rest: 120 },
    { name: "Pull-over câble", muscle: "Dos", icon: "↩️", repRange: "12-15", sets: 3, rest: 60 },
    { name: "Shrug barre", muscle: "Dos", icon: "🤷", repRange: "10-15", sets: 3, rest: 60 },
    { name: "Curl biceps barre", muscle: "Biceps", icon: "💪", repRange: "8-12", sets: 3, rest: 60 },
    { name: "Curl biceps barre EZ", muscle: "Biceps", icon: "💪", repRange: "8-12", sets: 3, rest: 60 },
    { name: "Curl haltères alterné", muscle: "Biceps", icon: "💪", repRange: "10-15", sets: 3, rest: 60 },
    { name: "Curl marteau", muscle: "Biceps", icon: "🔨", repRange: "10-15", sets: 3, rest: 60 },
    { name: "Curl concentration", muscle: "Biceps", icon: "🎯", repRange: "12-15", sets: 3, rest: 60 },
    { name: "Curl poulie basse", muscle: "Biceps", icon: "↖️", repRange: "12-15", sets: 3, rest: 60 },
  ],
  LEGS: [
    { name: "Squat barre", muscle: "Quadriceps", icon: "🏋️", repRange: "5-10", sets: 4, rest: 180 },
    { name: "Squat gobelet haltère", muscle: "Quadriceps", icon: "🏋️", repRange: "10-15", sets: 3, rest: 90 },
    { name: "Presse à cuisses", muscle: "Quadriceps", icon: "🦵", repRange: "8-15", sets: 4, rest: 120 },
    { name: "Hack squat machine", muscle: "Quadriceps", icon: "🦵", repRange: "8-12", sets: 3, rest: 120 },
    { name: "Extension jambes machine", muscle: "Quadriceps", icon: "🦵", repRange: "12-20", sets: 3, rest: 60 },
    { name: "Fentes avant haltères", muscle: "Quadriceps", icon: "🚶", repRange: "10-15", sets: 3, rest: 90 },
    { name: "Bulgarian split squat", muscle: "Fessiers", icon: "🦵", repRange: "8-12", sets: 3, rest: 120 },
    { name: "Hip thrust barre", muscle: "Fessiers", icon: "⬆️", repRange: "8-15", sets: 4, rest: 90 },
    { name: "Abduction hanche câble", muscle: "Fessiers", icon: "↔️", repRange: "15-20", sets: 3, rest: 60 },
    { name: "Soulevé de terre jambes tendues", muscle: "Ischio-jambiers", icon: "🏋️", repRange: "8-12", sets: 3, rest: 120 },
    { name: "Curl jambes couché machine", muscle: "Ischio-jambiers", icon: "🦵", repRange: "10-15", sets: 3, rest: 60 },
    { name: "Curl jambes assis machine", muscle: "Ischio-jambiers", icon: "🦵", repRange: "10-15", sets: 3, rest: 60 },
    { name: "Mollets debout machine", muscle: "Mollets", icon: "🦶", repRange: "10-20", sets: 4, rest: 60 },
    { name: "Mollets assis machine", muscle: "Mollets", icon: "🦶", repRange: "10-20", sets: 3, rest: 60 },
    { name: "Mollets presse à cuisses", muscle: "Mollets", icon: "🦶", repRange: "15-25", sets: 3, rest: 60 },
  ],
  CARDIO: [
    { name: "Marche rapide tapis (incliné)", muscle: "Cardio", icon: "🚶", repRange: "20-45 min", sets: 1, rest: 0 },
    { name: "Vélo stationnaire", muscle: "Cardio", icon: "🚴", repRange: "20-45 min", sets: 1, rest: 0 },
    { name: "Rameur", muscle: "Cardio", icon: "🚣", repRange: "10-20 min", sets: 1, rest: 0 },
    { name: "Corde à sauter", muscle: "Cardio", icon: "⚡", repRange: "5-15 min", sets: 3, rest: 60 },
    { name: "Elliptique", muscle: "Cardio", icon: "🏃", repRange: "20-40 min", sets: 1, rest: 0 },
  ],
};

// Populate lookup map once module is loaded
for (const exercises of Object.values(EXERCISE_LIBRARY)) {
  for (const ex of exercises) EXERCISE_MUSCLE_MAP[ex.name] = ex.muscle;
}
