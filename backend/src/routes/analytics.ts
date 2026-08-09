import { Router } from "express";
import { logEvent, getAnalyticsSummary, getUserById } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const analyticsRouter = Router();

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdmin(userId: string): boolean {
  if (ADMIN_EMAILS.length === 0) return false; // fail closed if unconfigured
  const user = getUserById(userId);
  return !!user && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

// Events a client is allowed to self-report. Keeps this endpoint from
// becoming an arbitrary-write sink — anything not in this list is dropped.
const ALLOWED_CLIENT_EVENTS = new Set([
  "signup_form_viewed",
  "day_opened",
  "speak_attempt",
  "dictation_attempt",
  "free_speak_attempt",
  "upgrade_clicked",
  "leaderboard_viewed",
]);

// POST /api/analytics/event  { eventType, metadata? }
// Fire-and-forget from the client — failures here should never break the app.
analyticsRouter.post("/event", requireAuth, (req, res) => {
  const { eventType, metadata } = req.body as { eventType?: string; metadata?: Record<string, unknown> };
  if (!eventType || !ALLOWED_CLIENT_EVENTS.has(eventType)) {
    return res.status(400).json({ error: "Unknown event type." });
  }
  logEvent(req.userId!, eventType, metadata);
  res.status(204).end();
});

// GET /api/analytics/summary — admin only, gated by ADMIN_EMAILS env var.
analyticsRouter.get("/summary", requireAuth, (req, res) => {
  if (!isAdmin(req.userId!)) {
    return res.status(403).json({ error: "Not authorized." });
  }
  res.json(getAnalyticsSummary());
});
