import { Router } from "express";
import { callLLM } from "../llm/index.js";
import { GRAMMAR_SYSTEM } from "../data/content.js";
import { checkDailyLimit, recordCall } from "./usageLimits.js";
import { getUserById } from "../db.js";

export const grammarRouter = Router();


// POST /api/grammar-check  { sentence: string }
grammarRouter.post("/", async (req, res) => {
  const { sentence } = req.body as { sentence?: string };
  const trimmed = (sentence ?? "").trim();

  if (!trimmed) {
    return res.status(400).json({ error: "sentence is required" });
  }

  if (!checkDailyLimit(req.userId!, "grammar", res)) return; // response already sent (429)

  try {
    const { text, tokensUsed } = await callLLM(GRAMMAR_SYSTEM, [{ role: "user", content: trimmed }], 300);
    recordCall(req.userId!, "grammar", tokensUsed);
    const xp = getUserById(req.userId!)?.xp ?? 0;
    res.json({ result: text || "Couldn't check that — try again.", xp });
  } catch (err) {
    console.error("grammar route error:", err);
    res.status(502).json({ error: "Couldn't reach the AI right now. Try again." });
  }
});
