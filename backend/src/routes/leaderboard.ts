import { Router } from "express";
import { getLeaderboard, getUserRank, setLeaderboardSettings, getUserById, logEvent } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const leaderboardRouter = Router();

const NICKNAME_RE = /^[a-zA-Z0-9 _-]{2,20}$/;

// GET /api/leaderboard — top 20 opted-in users by XP, plus the caller's own rank (if opted in).
leaderboardRouter.get("/", requireAuth, (req, res) => {
  const entries = getLeaderboard(20);
  const myRank = getUserRank(req.userId!);
  res.json({ entries, myRank });
});

// PUT /api/leaderboard/settings  { nickname, optIn }
// Explicit opt-in required — nothing is shown publicly until the user sets this themselves.
leaderboardRouter.put("/settings", requireAuth, (req, res) => {
  const { nickname, optIn } = req.body as { nickname?: string; optIn?: boolean };

  if (optIn) {
    const clean = (nickname ?? "").trim();
    if (!NICKNAME_RE.test(clean)) {
      return res.status(400).json({ error: "Nickname must be 2-20 characters (letters, numbers, spaces, - or _)." });
    }
    setLeaderboardSettings(req.userId!, clean, true);
    logEvent(req.userId!, "leaderboard_joined");
  } else {
    // Opting out: keep the nickname on file (in case they opt back in) but stop showing them.
    const user = getUserById(req.userId!);
    setLeaderboardSettings(req.userId!, user?.nickname ?? "", false);
  }

  const user = getUserById(req.userId!);
  res.json({ nickname: user?.nickname ?? null, leaderboardOptIn: !!user?.leaderboard_opt_in });
});
