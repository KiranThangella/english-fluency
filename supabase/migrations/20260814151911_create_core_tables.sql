/*
# Create core tables for English Fluency app

## Overview
Migrates the app's data model from SQLite to Supabase Postgres. The app has
a sign-in screen (JWT auth), so all tables are owner-scoped with RLS policies
restricted to `authenticated` users using `auth.uid()` ownership checks.

## New Tables

1. `users` — App-level user profile (separate from auth.users)
   - `id` uuid PK, matches auth.users.id
   - `email` text, unique
   - `plan` text ('free' | 'premium'), default 'free'
   - `stripe_customer_id` text, nullable
   - `stripe_subscription_id` text, nullable
   - `xp` integer, default 0
   - `nickname` text, nullable
   - `leaderboard_opt_in` boolean, default false
   - `email_verified` boolean, default false
   - `token_version` integer, default 0 (for JWT revocation)
   - `created_at` timestamptz, default now()

2. `auth_tokens` — Single-use tokens for password reset and email verification
   - `token_hash` text PK (SHA-256 hash of the raw token)
   - `user_id` uuid FK -> users(id) ON DELETE CASCADE
   - `kind` text ('reset' | 'verify')
   - `expires_at` timestamptz
   - `used` boolean, default false

3. `progress` — Per-user progress state (JSON blob)
   - `user_id` uuid PK, FK -> users(id) ON DELETE CASCADE
   - `data` jsonb (completed days, speak scores, weak words, sessions, etc.)
   - `updated_at` timestamptz, default now()

4. `usage` — Daily usage tracking per user (for free-tier caps)
   - `user_id` uuid, part of composite PK
   - `day` date, part of composite PK (UTC calendar day)
   - `chat_calls` integer, default 0
   - `grammar_calls` integer, default 0
   - `assessment_calls` integer, default 0
   - `tokens_used` integer, default 0

5. `events` — Append-only analytics event log
   - `id` bigserial PK
   - `user_id` uuid, nullable (anonymous events allowed)
   - `event_type` text
   - `metadata` jsonb, nullable
   - `created_at` timestamptz, default now()

## Security (RLS)
- RLS enabled on ALL tables.
- `users`: owner can read/update own row; no insert via anon (created server-side).
- `auth_tokens`: only owner can read their own tokens (for verification flows).
- `progress`: full owner-scoped CRUD.
- `usage`: owner can read their own usage; no direct insert/update/delete from client (managed server-side).
- `events`: owner can read own events; insert allowed for authenticated (server-side logging).

## Important Notes
1. The `users` table mirrors the SQLite schema but uses uuid/boolean/jsonb types.
2. `progress.data` is jsonb to allow flexible schema evolution without migrations.
3. `usage` uses a composite PK (user_id, day) matching the SQLite schema.
4. Indexes added on `events(event_type, created_at)` and `events(user_id)` for analytics queries.
5. Index on `auth_tokens(expires_at)` for token cleanup.
*/

-- ---- users ----
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  xp integer NOT NULL DEFAULT 0,
  nickname text,
  leaderboard_opt_in boolean NOT NULL DEFAULT false,
  email_verified boolean NOT NULL DEFAULT false,
  token_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_user" ON users;
CREATE POLICY "select_own_user" ON users FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_user" ON users;
CREATE POLICY "update_own_user" ON users FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---- auth_tokens ----
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires ON auth_tokens(expires_at);

ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_auth_tokens" ON auth_tokens;
CREATE POLICY "select_own_auth_tokens" ON auth_tokens FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ---- progress ----
CREATE TABLE IF NOT EXISTS progress (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_progress" ON progress;
CREATE POLICY "select_own_progress" ON progress FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_progress" ON progress;
CREATE POLICY "insert_own_progress" ON progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_progress" ON progress;
CREATE POLICY "update_own_progress" ON progress FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_progress" ON progress;
CREATE POLICY "delete_own_progress" ON progress FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---- usage ----
CREATE TABLE IF NOT EXISTS usage (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL,
  chat_calls integer NOT NULL DEFAULT 0,
  grammar_calls integer NOT NULL DEFAULT 0,
  assessment_calls integer NOT NULL DEFAULT 0,
  tokens_used integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_usage" ON usage;
CREATE POLICY "select_own_usage" ON usage FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ---- events ----
CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_type_time ON events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_events" ON events;
CREATE POLICY "select_own_events" ON events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_events" ON events;
CREATE POLICY "insert_own_events" ON events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
