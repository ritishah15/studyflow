// config/database.js
// Uses 'sqlite3' + 'sqlite' wrapper — pure JS, no C++ build tools needed on Windows

const path = require('path');
const fs   = require('fs');

const DB_PATH = process.env.DB_PATH || './data/studyflow.db';

// Ensure data directory exists
const dir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const sqlite3 = require('sqlite3').verbose();

// Open database (creates file if not exists)
const db = new sqlite3.Database(path.resolve(DB_PATH), (err) => {
  if (err) { console.error('[DB] Failed to open:', err.message); process.exit(1); }
});

// ── Promisified helpers (replaces better-sqlite3 sync API) ───────────────────

db.run_ = (sql, params = []) => new Promise((res, rej) =>
  db.run(sql, params, function(err) { err ? rej(err) : res({ lastID: this.lastID, changes: this.changes }); })
);

db.get_ = (sql, params = []) => new Promise((res, rej) =>
  db.get(sql, params, (err, row) => { err ? rej(err) : res(row || null); })
);

db.all_ = (sql, params = []) => new Promise((res, rej) =>
  db.all(sql, params, (err, rows) => { err ? rej(err) : res(rows || []); })
);

db.exec_ = (sql) => new Promise((res, rej) =>
  db.exec(sql, (err) => { err ? rej(err) : res(); })
);

// ── Schema Migrations ─────────────────────────────────────────────────────────

const migrations = [
  `PRAGMA foreign_keys = ON`,

  `CREATE TABLE IF NOT EXISTS users (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    email          TEXT UNIQUE NOT NULL,
    password_hash  TEXT NOT NULL,
    course         TEXT,
    plan           TEXT NOT NULL DEFAULT 'free',
    summaries_used INTEGER NOT NULL DEFAULT 0,
    plans_created  INTEGER NOT NULL DEFAULT 0,
    avatar_url     TEXT,
    is_active      INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS notes (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    raw_text   TEXT,
    summary    TEXT,
    key_points TEXT,
    topics     TEXT,
    difficulty TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS deadlines (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    due_date   TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'assignment',
    priority   TEXT NOT NULL DEFAULT 'medium',
    is_done    INTEGER NOT NULL DEFAULT 0,
    notes      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS study_plans (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    subject     TEXT NOT NULL,
    exam_date   TEXT NOT NULL,
    total_days  INTEGER,
    daily_hours REAL,
    level       TEXT,
    plan_json   TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS resource_searches (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic        TEXT NOT NULL,
    level        TEXT,
    results_json TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS payments (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    razorpay_order_id   TEXT UNIQUE,
    razorpay_payment_id TEXT,
    razorpay_signature  TEXT,
    amount              INTEGER NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'INR',
    status              TEXT NOT NULL DEFAULT 'created',
    plan                TEXT NOT NULL DEFAULT 'pro',
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_notes_user     ON notes(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_deadlines_user ON deadlines(user_id, due_date)`,
  `CREATE INDEX IF NOT EXISTS idx_plans_user     ON study_plans(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_payments_user  ON payments(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_refresh_user   ON refresh_tokens(user_id)`,
];

// Run migrations sequentially
async function runMigrations() {
  for (const sql of migrations) {
    await db.run_(sql).catch(() => {}); // ignore "already exists" errors
  }
  console.log(`[DB] SQLite ready → ${path.resolve(DB_PATH)}`);
}

// Export a promise that resolves when DB is ready
db.ready = runMigrations();

module.exports = db;
