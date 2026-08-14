import "dotenv/config";
import express from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat.js";
import { grammarRouter } from "./routes/grammar.js";
import { assessmentRouter } from "./routes/assessment.js";
import { progressRouter } from "./routes/progress.js";
import { authRouter } from "./routes/auth.js";
import { billingRouter } from "./routes/billing.js";
import { leaderboardRouter } from "./routes/leaderboard.js";
import { analyticsRouter } from "./routes/analytics.js";
import { requireAuth } from "./middleware/requireAuth.js";

// Fail loudly and immediately if required config is missing, instead of
// booting "successfully" and then crashing the whole process the first time
// someone hits an endpoint that needs it (which looks like a random 502 to
// everyone using the app, not an obvious startup error in the logs).
if (!process.env.JWT_SECRET) {
  console.error(
    "FATAL: JWT_SECRET is not set. Copy backend/.env.example to .env (or set it in your host's " +
    "environment variables) — generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// CORS_ORIGIN can be a comma-separated list, e.g.
// "http://localhost:5173,https://yourapp.pages.dev" — so local dev and your
// deployed frontend can both talk to this backend without editing env vars
// every time you switch between them.
const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header (curl, server-to-server, some mobile webviews) — allow it.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin "${origin}" is not in CORS_ORIGIN`));
    },
  })
);

// The Stripe webhook needs the raw request body to verify signatures, so it
// must NOT go through express.json(). Every other route gets JSON parsing.
app.use((req, res, next) => {
  if (req.originalUrl === "/api/billing/webhook") return next();
  express.json()(req, res, next);
});
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

app.get("/", (_req, res) => res.json({ ok: true, service: "english-fluency-backend" }));
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/billing", billingRouter);
app.use("/api/chat", requireAuth, chatRouter);
app.use("/api/grammar-check", requireAuth, grammarRouter);
app.use("/api/assessment", requireAuth, assessmentRouter);
app.use("/api/progress", requireAuth, progressRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/analytics", analyticsRouter);

// Catches errors thrown synchronously inside route handlers (e.g. a bad
// config value, a bug) and turns them into a 500 for that one request,
// instead of an unhandled exception that (on modern Node) kills the entire
// process — which is what would otherwise take the whole app down for
// every user because of one bad request.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled route error:", err);
  if (!res.headersSent) res.status(500).json({ error: "Something went wrong on our end." });
});

// Last-resort safety net for anything that slips past the handler above
// (e.g. a rejected promise nobody awaited). Logs instead of crashing —
// losing one request's error is far better than taking the whole server
// down for everyone currently using it.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

app.listen(PORT, () => {
  console.log(`English Fluency backend running on http://localhost:${PORT}`);
});
