import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";

let dbInstance: Database.Database | null = null;
let dbError: Error | null = null;

export function getDbError(): Error | null {
  return dbError;
}

export function getDb(): Database.Database | null {
  if (dbInstance) return dbInstance;
  try {
    const DatabaseConstructor = require("better-sqlite3") as typeof import("better-sqlite3"); // eslint-disable-line
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, "shred.db");
    dbInstance = new DatabaseConstructor(dbPath);
    dbInstance.pragma("journal_mode = WAL");
    dbInstance.pragma("foreign_keys = ON");
    initSchema(dbInstance);
    dbError = null;
    return dbInstance;
  } catch (e) {
    dbError = e instanceof Error ? e : new Error(String(e));
    return null;
  }
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      date TEXT,
      template INTEGER NOT NULL DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      weight REAL,
      body_fat REAL,
      day_type TEXT NOT NULL DEFAULT 'training',
      session_id INTEGER,
      calories REAL,
      protein REAL,
      carbs REAL,
      fat REAL,
      water REAL,
      creatine INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS food_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      quantity REAL,
      unit TEXT,
      calories REAL,
      protein REAL,
      carbs REAL,
      fat REAL,
      FOREIGN KEY (log_id) REFERENCES daily_logs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sets INTEGER NOT NULL DEFAULT 3,
      reps_target TEXT NOT NULL DEFAULT '8-10',
      rest_seconds INTEGER NOT NULL DEFAULT 90,
      order_index INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workout_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      set_number INTEGER NOT NULL,
      weight_kg REAL NOT NULL,
      reps_done TEXT NOT NULL,
      rpe REAL,
      notes TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fast_walks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      duration_minutes REAL NOT NULL,
      distance_km REAL,
      notes TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS whoop_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      recovery_score REAL NOT NULL,
      hrv REAL,
      resting_hr REAL,
      sleep_hours REAL,
      sleep_score REAL,
      strain REAL,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_food_log ON food_items(log_id);
    CREATE INDEX IF NOT EXISTS idx_ex_session ON exercises(session_id);
    CREATE INDEX IF NOT EXISTS idx_wl_session_date ON workout_logs(session_id, date);
    CREATE INDEX IF NOT EXISTS idx_walks_session ON fast_walks(session_id, date);
  `);
}
