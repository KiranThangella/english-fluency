import { Router } from "express";
import { getProgress, saveProgress, addXp, getUserById, logEvent, type ProgressState } from "../db.js";

export const progressRouter = Router();

const XP_PER_COMPLETED_DAY = 10;

// GET /api/progress
progressRouter.get("/", (req, res) => {
  res.json(getProgress(req.userId!));
});

// PUT /api/progress  (full or partial state, merged onto what's stored)
progressRouter.put("/", (req, res) => {
  const current = getProgress(req.userId!);
  const next: ProgressState = { ...current, ...(req.body ?? {}) };

  // Award XP only for days that weren't already marked complete, so
  // re-saving the same progress repeatedly can't be used to farm XP.
  const newlyCompleted = (next.completedDays ?? []).filter((d) => !current.completedDays?.includes(d));
  if (newlyCompleted.length > 0) {
    addXp(req.userId!, newlyCompleted.length * XP_PER_COMPLETED_DAY);
    for (const day of newlyCompleted) logEvent(req.userId!, "day_completed", { day });
  }

  saveProgress(req.userId!, next);
  const xp = getUserById(req.userId!)?.xp ?? 0;
  res.json({ ...next, xp });
});
