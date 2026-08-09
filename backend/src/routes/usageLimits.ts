import type { Response } from "express";
import { getTodayUsage, recordUsage, getUserById, logEvent } from "../db.js";

const CHAT_DAILY_LIMIT = Number(process.env.FREE_CHAT_DAILY_LIMIT ?? 20);
const GRAMMAR_DAILY_LIMIT = Number(process.env.FREE_GRAMMAR_DAILY_LIMIT ?? 30);

/**
 * Checks whether userId has room left for one more call of `kind` today.
 * Premium-plan users skip the cap entirely. If the free cap is hit, writes
 * a 429 response and returns false — caller should stop. If there's room,
 * returns true and does NOT record anything yet (call recordCall after the
 * LLM call actually succeeds, so failed calls aren't charged against limit).
 */
export function checkDailyLimit(userId: string, kind: "chat" | "grammar", res: Response): boolean {
  const user = getUserById(userId);
  if (user?.plan === "premium") return true;

  const limit = kind === "chat" ? CHAT_DAILY_LIMIT : GRAMMAR_DAILY_LIMIT;
  const usage = getTodayUsage(userId);
  const used = kind === "chat" ? usage.chat_calls : usage.grammar_calls;

  if (used >= limit) {
    logEvent(userId, "daily_limit_hit", { kind, limit }); // a real signal for "is the free tier too tight/loose"
    res.status(429).json({
      error:
        kind === "chat"
          ? `Daily chat limit reached (${limit}/day). Come back tomorrow, or upgrade for unlimited practice.`
          : `Daily grammar-check limit reached (${limit}/day). Come back tomorrow, or upgrade for unlimited checks.`,
      limitReached: true,
      kind,
      limit,
    });
    return false;
  }
  return true;
}

export function recordCall(userId: string, kind: "chat" | "grammar", tokensUsed: number): void {
  recordUsage(userId, kind, tokensUsed);
  logEvent(userId, kind === "chat" ? "chat_message_sent" : "grammar_check_used", { tokensUsed });
}
