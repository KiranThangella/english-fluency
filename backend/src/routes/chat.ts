import { Router } from "express";
import { callLLM, type LLMMessage } from "../llm/index.js";
import { SCENARIOS, CHAT_SUFFIX } from "../data/content.js";
import { checkDailyLimit, recordCall } from "./usageLimits.js";
import { getUserById } from "../db.js";

export const chatRouter = Router();


// GET /api/chat/scenarios — list available roleplay scenarios for the UI
chatRouter.get("/scenarios", (_req, res) => {
  res.json({ scenarios: SCENARIOS });
});

// POST /api/chat  { scenarioId: string, customDescription?: string, messages: {role, content}[] }
chatRouter.post("/", async (req, res) => {
  const { scenarioId, customDescription, messages } = req.body as {
    scenarioId?: string;
    customDescription?: string;
    messages?: LLMMessage[];
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  if (!checkDailyLimit(req.userId!, "chat", res)) return; // response already sent (429)

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const baseSystem =
    scenario.id === "custom"
      ? `You are roleplaying as described by the learner: "${(customDescription ?? "").trim() || "a general conversation partner"}". Stay fully in character and keep it realistic.`
      : scenario.system;

  const system = baseSystem + CHAT_SUFFIX;

  try {
    const { text, tokensUsed } = await callLLM(system, messages.slice(-10));
    recordCall(req.userId!, "chat", tokensUsed);
    const xp = getUserById(req.userId!)?.xp ?? 0;
    res.json({ reply: text || "Sorry, could you say that again?", xp });
  } catch (err) {
    console.error("chat route error:", err);
    res.status(502).json({ error: "Couldn't reach the AI right now. Try again." });
  }
});
