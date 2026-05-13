import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;
let _initialized = false;
let _error: Error | null = null;

export function getDbError(): Error | null {
  return _error;
}

function makeClient(): Client | null {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    _error = new Error("TURSO_DATABASE_URL not configured");
    return null;
  }
  try {
    _client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN ?? "" });
    return _client;
  } catch (e) {
    _error = e instanceof Error ? e : new Error(String(e));
    return null;
  }
}

export async function getDb(): Promise<Client | null> {
  const client = makeClient();
  if (!client) return null;
  if (_initialized) return client;
  try {
    await initSchema(client);
    _initialized = true;
    _error = null;
    return client;
  } catch (e) {
    _error = e instanceof Error ? e : new Error(String(e));
    return null;
  }
}

async function initSchema(db: Client) {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      date TEXT,
      template INTEGER NOT NULL DEFAULT 0,
      notes TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS daily_logs (
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
    )`,
    `CREATE TABLE IF NOT EXISTS food_items (
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
    )`,
    `CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sets INTEGER NOT NULL DEFAULT 3,
      reps_target TEXT NOT NULL DEFAULT '8-10',
      rest_seconds INTEGER NOT NULL DEFAULT 90,
      order_index INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS workout_logs (
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
    )`,
    `CREATE TABLE IF NOT EXISTS fast_walks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      duration_minutes REAL NOT NULL,
      distance_km REAL,
      incline_percent REAL,
      speed_kmh REAL,
      notes TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS whoop_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      recovery_score REAL NOT NULL,
      hrv REAL,
      resting_hr REAL,
      sleep_hours REAL,
      sleep_score REAL,
      strain REAL,
      notes TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_food_log ON food_items(log_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ex_session ON exercises(session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_wl_session_date ON workout_logs(session_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_walks_session ON fast_walks(session_id, date)`,
  ], "write");
  // Safe migrations — silenced if column already exists
  await db.execute(`ALTER TABLE food_items ADD COLUMN meal TEXT DEFAULT 'meal1'`).catch(() => {});
  // One-time cleanup: delete the "Jambes" template and its exercise definitions.
  // workout_logs are intentionally preserved (keepLogs pattern).
  await db.batch([
    `DELETE FROM exercises WHERE session_id IN (SELECT id FROM sessions WHERE name = 'Jambes' AND template = 1)`,
    `DELETE FROM sessions WHERE name = 'Jambes' AND template = 1`,
  ], "write").catch(() => {});
}
