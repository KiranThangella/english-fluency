import type { Response } from "express";
import { getTodayUsage, recordUsage, getUserById, logEvent } from "../db.js";

const CHAT_DAILY_LIMIT = Number(process.env.FREE_CHAT_DAILY_LIMIT ?? 20);
const GRAMMAR_DAILY_LIMIT = Number(process.env.FREE_GRAMMAR_DAILY_LIMIT ?? 30);
const ASSESSMENT_DAILY_LIMIT = Number(process.env.FREE_ASSESSMENT_DAILY_LIMIT ?? 25);

/**
 * Checks whether userId has room left for one more call of `kind` today.
 * Premium-plan users skip the cap entirely. If the free cap is hit, writes
 * a 429 response and returns false — caller should stop. If there's room,
 * returns true and does NOT record anything yet (call recordCall after the
 * LLM call actually succeeds, so failed calls aren't charged against limit).
 */
export function checkDailyLimit(userId: string, kind: "chat" | "grammar" | "assessment", res: Response): boolean {
  const user = getUserById(userId);
  if (user?.plan === "premium") return true;

  const limit = kind === "chat" ? CHAT_DAILY_LIMIT : kind === "grammar" ? GRAMMAR_DAILY_LIMIT : ASSESSMENT_DAILY_LIMIT;
  const usage = getTodayUsage(userId);
  const used = kind === "chat" ? usage.chat_calls : kind === "grammar" ? usage.grammar_calls : usage.assessment_calls;

  if (used >= limit) {
    logEvent(userId, "daily_limit_hit", { kind, limit }); // a real signal for "is the free tier too tight/loose"
    res.status(429).json({
      error:
        kind === "chat"
          ? `Daily chat limit reached (${limit}/day). Come back tomorrow, or upgrade for unlimited practice.`
          : kind === "grammar"
            ? `Daily grammar-check limit reached (${limit}/day). Come back tomorrow, or upgrade for unlimited checks.`
            : `Daily feedback limit reached (${limit}/day). Come back tomorrow, or upgrade for unlimited AI feedback.`,
      limitReached: true,
      kind,
      limit,
    });
    return false;
  }
  return true;
}

export function recordCall(userId: string, kind: "chat" | "grammar" | "assessment", tokensUsed: number): void {
  recordUsage(userId, kind, tokensUsed);
  logEvent(userId, kind === "chat" ? "chat_message_sent" : kind === "grammar" ? "grammar_check_used" : "speaking_assessment_used", { tokensUsed });
}
