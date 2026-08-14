import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Override with DB_PATH to point at a mounted persistent disk (e.g. Render's
// "Disks" feature) — without this, SQLite writes to a path that gets wiped
// on every redeploy, since most hosts don't persist the app's own folder.
const dbPath = process.env.DB_PATH ?? path.join(__dirname, "..", "fluency.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    xp INTEGER NOT NULL DEFAULT 0,
    nickname TEXT,
    leaderboard_opt_in INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration-safe: adds columns to a users table created before gamification
// existed. better-sqlite3 throws "duplicate column" if it's already there —
// that's expected and fine to ignore.
for (const stmt of [
  "ALTER TABLE users ADD COLUMN xp INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN nickname TEXT",
  "ALTER TABLE users ADD COLUMN leaderboard_opt_in INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0",
]) {
  try { db.exec(stmt); } catch { /* column already exists */ }
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  plan: "free" | "premium";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  xp: number;
  nickname: string | null;
  leaderboard_opt_in: 0 | 1;
  email_verified: 0 | 1;
  token_version: number;
  created_at: string;
}

export function createUser(id: string, email: string, passwordHash: string): UserRow {
  db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(id, email, passwordHash);
  return getUserById(id)!;
}

export function getUserByEmail(email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

export function getUserById(id: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function setUserPlan(id: string, plan: "free" | "premium", stripeCustomerId?: string, stripeSubscriptionId?: string): void {
  db.prepare(
    "UPDATE users SET plan = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = COALESCE(?, stripe_subscription_id) WHERE id = ?"
  ).run(plan, stripeCustomerId ?? null, stripeSubscriptionId ?? null, id);
}

export function getUserByStripeCustomerId(stripeCustomerId: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE stripe_customer_id = ?").get(stripeCustomerId) as UserRow | undefined;
}

/** Adds (or subtracts, with a negative amount) XP for a user. Never goes below 0. */
export function addXp(userId: string, amount: number): void {
  db.prepare("UPDATE users SET xp = MAX(0, xp + ?) WHERE id = ?").run(amount, userId);
}

export function setLeaderboardSettings(userId: string, nickname: string, optIn: boolean): void {
  db.prepare("UPDATE users SET nickname = ?, leaderboard_opt_in = ? WHERE id = ?").run(nickname, optIn ? 1 : 0, userId);
}

export interface LeaderboardEntry {
  nickname: string;
  xp: number;
}

export function getLeaderboard(limit = 20): LeaderboardEntry[] {
  return db
    .prepare("SELECT nickname, xp FROM users WHERE leaderboard_opt_in = 1 AND nickname IS NOT NULL ORDER BY xp DESC LIMIT ?")
    .all(limit) as LeaderboardEntry[];
}

/** A user's rank among opted-in users (1-based), or null if they haven't opted in. */
export function getUserRank(userId: string): number | null {
  const user = getUserById(userId);
  if (!user || !user.leaderboard_opt_in) return null;
  const row = db
    .prepare("SELECT COUNT(*) as higher FROM users WHERE leaderboard_opt_in = 1 AND xp > ?")
    .get(user.xp) as { higher: number };
  return row.higher + 1;
}

export function setPasswordHash(userId: string, passwordHash: string): void {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
}

/** Invalidates every JWT issued for this user so far (password reset, "log out everywhere", etc). */
export function bumpTokenVersion(userId: string): void {
  db.prepare("UPDATE users SET token_version = token_version + 1 WHERE id = ?").run(userId);
}

export function markEmailVerified(userId: string): void {
  db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(userId);
}

// Single-use tokens for password reset and email verification. Only the
// SHA-256 hash of the token is stored — same principle as a password hash —
// so a DB read alone can't be used to reset someone's password or verify
// their email; you also need the raw token, which only goes out over email.
db.exec(`
  CREATE TABLE IF NOT EXISTS auth_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,          -- 'reset' | 'verify'
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );
`);

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a single-use token valid for `ttlMinutes`, returns the RAW token (only stored as a hash). */
export function createAuthToken(userId: string, kind: "reset" | "verify", ttlMinutes: number): string {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  db.prepare("INSERT INTO auth_tokens (token_hash, user_id, kind, expires_at) VALUES (?, ?, ?, ?)").run(
    hashToken(token), userId, kind, expiresAt
  );
  return token;
}

/** Validates and consumes a token (marks it used so it can't be replayed). Returns the userId, or null if invalid/expired/already used. */
export function consumeAuthToken(rawToken: string, kind: "reset" | "verify"): string | null {
  const row = db
    .prepare("SELECT user_id, kind, expires_at, used FROM auth_tokens WHERE token_hash = ?")
    .get(hashToken(rawToken)) as { user_id: string; kind: string; expires_at: string; used: number } | undefined;

  if (!row || row.kind !== kind || row.used) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  db.prepare("UPDATE auth_tokens SET used = 1 WHERE token_hash = ?").run(hashToken(rawToken));
  return row.user_id;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS progress (
    user_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// One row per user per calendar day (UTC). Tracks call counts (for daily
// caps) and token counts (for cost visibility) separately per feature,
// since chat and grammar-check have very different cost profiles.
db.exec(`
  CREATE TABLE IF NOT EXISTS usage (
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    chat_calls INTEGER NOT NULL DEFAULT 0,
    grammar_calls INTEGER NOT NULL DEFAULT 0,
    assessment_calls INTEGER NOT NULL DEFAULT 0,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  );
`);

// Migration-safe: add assessment_calls to usage tables created before it existed.
try { db.exec("ALTER TABLE usage ADD COLUMN assessment_calls INTEGER NOT NULL DEFAULT 0"); } catch { /* column already exists */ }

export interface UsageRow {
  chat_calls: number;
  grammar_calls: number;
  assessment_calls: number;
  tokens_used: number;
}

const EMPTY_USAGE: UsageRow = { chat_calls: 0, grammar_calls: 0, assessment_calls: 0, tokens_used: 0 };

function today(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD", UTC
}

export function getTodayUsage(userId: string): UsageRow {
  const row = db
    .prepare("SELECT chat_calls, grammar_calls, assessment_calls, tokens_used FROM usage WHERE user_id = ? AND day = ?")
    .get(userId, today()) as UsageRow | undefined;
  return row ?? EMPTY_USAGE;
}

/** Records one call of the given kind plus its token cost for today, and awards a small XP amount for the activity. */
export function recordUsage(userId: string, kind: "chat" | "grammar" | "assessment", tokens: number): void {
  const column = kind === "chat" ? "chat_calls" : kind === "grammar" ? "grammar_calls" : "assessment_calls";
  db.prepare(
    `INSERT INTO usage (user_id, day, ${column}, tokens_used) VALUES (?, ?, 1, ?)
     ON CONFLICT(user_id, day) DO UPDATE SET
       ${column} = ${column} + 1,
       tokens_used = tokens_used + excluded.tokens_used`
  ).run(userId, today(), tokens);
  addXp(userId, kind === "chat" ? 2 : kind === "grammar" ? 1 : 2);
}

/** Total tokens spent by a user across all time — handy for a lifetime cost view. */
export function getLifetimeTokens(userId: string): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(tokens_used), 0) as total FROM usage WHERE user_id = ?")
    .get(userId) as { total: number };
  return row.total;
}

export interface ProgressState {
  completedDays: number[];
  speakScores: Record<string, number>;
  weakWords: Record<string, number>;
  sessions: Array<{ day: number; wpm: number; fillers: number; wordCount: number; ts: number }>;
  selectedDay: number;
  darkMode: boolean;
}

const DEFAULT_STATE: ProgressState = {
  completedDays: [],
  speakScores: {},
  weakWords: {},
  sessions: [],
  selectedDay: 1,
  darkMode: true,
};

export function getProgress(userId: string): ProgressState {
  const row = db.prepare("SELECT data FROM progress WHERE user_id = ?").get(userId) as { data: string } | undefined;
  if (!row) return DEFAULT_STATE;
  try {
    return { ...DEFAULT_STATE, ...JSON.parse(row.data) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveProgress(userId: string, state: ProgressState): void {
  db.prepare(
    `INSERT INTO progress (user_id, data, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).run(userId, JSON.stringify(state));
}

// ---- Analytics ----
// A single append-only event log. Deliberately simple (no separate
// warehouse, no external tool) — enough to answer "what are people
// actually doing" without adding infrastructure before you have users.

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    event_type TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_events_type_time ON events (event_type, created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_events_user ON events (user_id)`);

export function logEvent(userId: string | null, eventType: string, metadata?: Record<string, unknown>): void {
  db.prepare("INSERT INTO events (user_id, event_type, metadata) VALUES (?, ?, ?)").run(
    userId, eventType, metadata ? JSON.stringify(metadata) : null
  );
}

export interface AnalyticsSummary {
  totalUsers: number;
  freeUsers: number;
  premiumUsers: number;
  verifiedUsers: number;
  leaderboardOptIns: number;
  signupsLast14Days: { day: string; count: number }[];
  activeUsersLast14Days: { day: string; count: number }[]; // distinct users with >=1 event that day
  eventCountsLast30Days: { eventType: string; count: number }[];
  day1Retention: number | null;  // % of users active on their signup day, active again the next day (last 30 signups)
  day7Retention: number | null;  // same, 7 days out
}

export function getAnalyticsSummary(): AnalyticsSummary {
  const totalUsers = (db.prepare("SELECT COUNT(*) as n FROM users").get() as { n: number }).n;
  const freeUsers = (db.prepare("SELECT COUNT(*) as n FROM users WHERE plan = 'free'").get() as { n: number }).n;
  const premiumUsers = totalUsers - freeUsers;
  const verifiedUsers = (db.prepare("SELECT COUNT(*) as n FROM users WHERE email_verified = 1").get() as { n: number }).n;
  const leaderboardOptIns = (db.prepare("SELECT COUNT(*) as n FROM users WHERE leaderboard_opt_in = 1").get() as { n: number }).n;

  const signupsLast14Days = db
    .prepare(
      `SELECT date(created_at) as day, COUNT(*) as count FROM users
       WHERE created_at >= datetime('now', '-14 days')
       GROUP BY day ORDER BY day ASC`
    )
    .all() as { day: string; count: number }[];

  const activeUsersLast14Days = db
    .prepare(
      `SELECT date(created_at) as day, COUNT(DISTINCT user_id) as count FROM events
       WHERE created_at >= datetime('now', '-14 days') AND user_id IS NOT NULL
       GROUP BY day ORDER BY day ASC`
    )
    .all() as { day: string; count: number }[];

  const eventCountsLast30Days = db
    .prepare(
      `SELECT event_type as eventType, COUNT(*) as count FROM events
       WHERE created_at >= datetime('now', '-30 days')
       GROUP BY event_type ORDER BY count DESC`
    )
    .all() as { eventType: string; count: number }[];

  // Retention: of users who signed up N+ days ago (capped to the most recent
  // 30 signups so this stays cheap), what % had any event on day 1 / day 7
  // after their signup date.
  function retention(daysOut: number): number | null {
    const cohort = db
      .prepare(
        `SELECT id, created_at FROM users
         WHERE created_at <= datetime('now', ?) ORDER BY created_at DESC LIMIT 30`
      )
      .all(`-${daysOut} days`) as { id: string; created_at: string }[];
    if (cohort.length === 0) return null;

    let retained = 0;
    for (const u of cohort) {
      const hit = db
        .prepare(
          `SELECT 1 FROM events WHERE user_id = ?
           AND date(created_at) = date(?, '+${daysOut} days') LIMIT 1`
        )
        .get(u.id, u.created_at);
      if (hit) retained++;
    }
    return Math.round((retained / cohort.length) * 100);
  }

  return {
    totalUsers, freeUsers, premiumUsers, verifiedUsers, leaderboardOptIns,
    signupsLast14Days, activeUsersLast14Days, eventCountsLast30Days,
    day1Retention: retention(1),
    day7Retention: retention(7),
  };
}
