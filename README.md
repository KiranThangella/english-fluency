# English Fluency — 69 Day Trail

A full-stack spoken-English practice app: speech-scored phrases, an AI conversation
partner with roleplay scenarios, pronunciation drills, dictation, grammar checking,
and a fluency analytics dashboard (WPM, filler words, accuracy trend).

Separated frontend/backend, same pattern as MindWriter Prism:
- **backend/** — Express + TypeScript API. Holds the Anthropic API key server-side
  and persists progress in SQLite.
- **frontend/** — React + Vite + TypeScript + Tailwind. Talks to the backend through
  a dev proxy at `/api`, so no fetch URLs need to change between dev and prod.

## Why a backend at all

The original version called the Anthropic API straight from the browser (fine inside
a Claude artifact sandbox, not fine in a real deployed app — it would expose your API
key to anyone who opens dev tools). This version moves those calls — chat, roleplay,
and grammar-check — behind two small backend routes, and adds real persistence so
progress survives across devices instead of living in one browser's storage.

## Quick start

```bash
# 1. Backend
cd backend
cp .env.example .env        # set JWT_SECRET + at least one LLM provider key
npm install
npm run dev                 # http://localhost:4000

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

The frontend dev server proxies `/api/*` to `http://localhost:4000`, so `fetch('/api/chat')`
works identically in dev and in production (once you build the frontend and serve it
behind the same domain/reverse proxy as the backend).

## Browser requirement

Speech scoring, dictation-by-ear, and the mic input all use the Web Speech API
(`SpeechRecognition`), which currently only ships in Chromium browsers (Chrome, Edge).
Everything else — reading, typing, grammar check, the AI chat via text — works everywhere.

## Project structure

```
backend/
  src/
    index.ts             # Express app, CORS, JSON body parsing, startup checks
    db.ts                # SQLite (better-sqlite3) setup + schema
    auth.ts               # password hashing, JWT signing/verification
    stripeVerify.ts        # Stripe webhook signature verification
    emailSender.ts          # transactional email (Resend), dev-mode console fallback
    llm/                    # multi-provider LLM layer (Anthropic/OpenAI/Gemini + fallback)
    middleware/
      requireAuth.ts         # JWT auth guard, checks token_version for revocation
    routes/
      auth.ts                # signup/login/me, forgot/reset password, email verification
      billing.ts              # Stripe checkout + webhook
      chat.ts                 # POST /api/chat            (conversation + roleplay)
      grammar.ts               # POST /api/grammar-check    (single sentence check)
      progress.ts               # GET/PUT /api/progress      (persisted learner state)
      leaderboard.ts             # opt-in XP leaderboard
      analytics.ts                # event logging + admin summary dashboard
      usageLimits.ts               # shared daily free-tier cap logic
    data/
      content.ts                   # day plan, tricky sounds, roleplay scenarios (shared shape)
frontend/
  src/
    App.tsx              # tab shell: Trail / Talk / Sounds / Progress
    theme.ts              # light + dark theme tokens
    data/content.ts       # same day-plan data, used for rendering
    lib/speech.ts          # SpeechRecognition + speechSynthesis + diff scoring helpers
    lib/api.ts              # fetch wrappers for every backend route
    components/            # SpeakCard, DictationDrill, FreeSpeakChallenge, ChatPractice,
                             # TrickySounds, ProgressDashboard, GrammarCheck, AuthGate,
                             # ResetPasswordScreen, Leaderboard, AdminDashboard, NebulaBackground, Stone
```

## Deployment

**Backend → Render.** A `render.yaml` blueprint at the repo root already declares
the build/start commands, health check path, and persistent disk — use it instead
of configuring by hand:

1. Push this repo to GitHub.
2. Render dashboard → **New +** → **Blueprint** → select the repo. Render reads
   `render.yaml` and sets everything up automatically (build command, start
   command, health check, and a persistent disk mounted so SQLite survives redeploys).
3. It'll prompt you for the env vars marked `sync: false` in `render.yaml`
   (`JWT_SECRET`, `CORS_ORIGIN`, and whichever optional provider keys you're using)
   — fill those in before deploying.
4. Once live, Render gives you a URL like `https://english-fluency-backend.onrender.com`.

If you'd rather set it up manually instead of via Blueprint: Root Directory
`backend`, Build Command `npm install && npm run build`, Start Command `npm run start`,
Health Check Path `/api/health` — plus a Disk mounted at `/opt/render/project/data`
with `DB_PATH=/opt/render/project/data/fluency.db` set as an env var.

**Frontend → Cloudflare Pages.**
```
cd frontend
# frontend/.env — point at your deployed Render backend:
# VITE_API_BASE_URL=https://your-service.onrender.com
npm run build
npx wrangler pages deploy dist
```
Then set `CORS_ORIGIN` on the Render backend to match your Pages URL.

**Once deployed, it's installable as an app** — no App Store needed. It's set
up as a PWA (`frontend/public/manifest.json` + `sw.js`): visiting the deployed
URL in Chrome/Edge (desktop or Android) shows an "Install" prompt that adds a
real app icon and opens without browser chrome. On iOS Safari, use Share →
"Add to Home Screen" (Apple doesn't show an automatic install prompt like
Chrome does, but the result is the same). This is the fastest path to a
"downloadable app" — full native builds (Capacitor, below) are a bigger step
worth taking later, once this is validated.

## Mobile (iOS / Android via Capacitor)

The frontend is wrapped for native builds using Capacitor. This can't be
finished in a sandbox — it needs Xcode (iOS, macOS only) or Android Studio
(Android) on your own machine — but everything up to that point is ready:

1. **Point the app at your deployed backend.** A native build has no "same
   origin" to talk to, unlike the web version — set this before building:
   ```
   # frontend/.env
   VITE_API_BASE_URL=https://your-deployed-backend.com
   ```
2. **Add the native platform(s):**
   ```
   cd frontend
   npm install
   npm run cap:add:ios       # or cap:add:android — needs Xcode / Android Studio installed
   npm run cap:sync          # builds the web app and copies it into the native project
   npm run cap:open:ios      # or cap:open:android — opens Xcode / Android Studio
   ```
3. From there it's a normal native app: run on a simulator/device from Xcode
   or Android Studio, set your app icon and splash screen, and follow Apple's
   / Google's normal store submission process.

**What this does NOT include** (real work, not just missing config):
- **App icon / splash screen** — Capacitor ships with placeholder ones.
- **Push notifications** — needs `@capacitor/push-notifications` plus APNs/FCM setup.
- **Deep links back into the app** (e.g. tapping a password-reset email link
  and landing in the native app instead of a browser) — needs a custom URL
  scheme or Universal Links/App Links configured per-platform. Right now,
  reset/verify links open in the device's browser, which still works, just
  isn't as polished.
- **Speech recognition on native** — the app currently uses the browser's
  `SpeechRecognition` API (`lib/speech.ts`), which works in the Capacitor
  WebView on Android but is unreliable on iOS. For a real iOS release, swap
  in `@capacitor-community/speech-recognition` (wraps Apple's native
  on-device speech API) instead.

## Next steps if you want to take this further

- Swap SQLite for Postgres if you expect more than one concurrent user
- Add the deep-linking and native speech-recognition items above before an
  actual App Store / Play Store submission
- Get a few real users through the whole flow before spending more time building
