import { Router } from "express";
import { callLLM } from "../llm/index.js";
import { ASSESSMENT_SYSTEM } from "../data/content.js";
import { checkDailyLimit, recordCall } from "./usageLimits.js";
import { getUserById } from "../db.js";

export const assessmentRouter = Router();

export interface AssessmentResult {
  fluencyScore: number;
  grammarScore: number;
  vocabularyScore: number;
  overallScore: number;
  strengths: string[];
  improvements: string[];
  correctedVersion: string;
  tip: string;
}

function parseAssessment(raw: string): AssessmentResult | null {
  // Strip markdown code fences if the LLM wrapped the JSON in them
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  try {
    const obj = JSON.parse(cleaned);
    if (typeof obj.overallScore !== "number") return null;
    return {
      fluencyScore: Math.max(0, Math.min(100, Math.round(obj.fluencyScore ?? 0))),
      grammarScore: Math.max(0, Math.min(100, Math.round(obj.grammarScore ?? 0))),
      vocabularyScore: Math.max(0, Math.min(100, Math.round(obj.vocabularyScore ?? 0))),
      overallScore: Math.max(0, Math.min(100, Math.round(obj.overallScore ?? 0))),
      strengths: Array.isArray(obj.strengths) ? obj.strengths.filter((s: unknown) => typeof s === "string").slice(0, 4) : [],
      improvements: Array.isArray(obj.improvements) ? obj.improvements.filter((s: unknown) => typeof s === "string").slice(0, 4) : [],
      correctedVersion: typeof obj.correctedVersion === "string" ? obj.correctedVersion : "",
      tip: typeof obj.tip === "string" ? obj.tip : "",
    };
  } catch {
    return null;
  }
}

// POST /api/assessment  { transcript: string, target?: string, prompt?: string }
assessmentRouter.post("/", async (req, res) => {
  const { transcript, target, prompt } = req.body as {
    transcript?: string;
    target?: string;
    prompt?: string;
  };

  const trimmed = (transcript ?? "").trim();
  if (!trimmed) {
    return res.status(400).json({ error: "transcript is required" });
  }

  if (!checkDailyLimit(req.userId!, "assessment", res)) return;

  const userMessage = target
    ? `Target sentence: "${target}"\n\nWhat the learner said: "${trimmed}"`
    : prompt
      ? `Speaking prompt: "${prompt}"\n\nWhat the learner said: "${trimmed}"`
      : `What the learner said: "${trimmed}"`;

  try {
    const { text, tokensUsed } = await callLLM(ASSESSMENT_SYSTEM, [{ role: "user", content: userMessage }], 400);
    const assessment = parseAssessment(text);
    if (!assessment) {
      console.error("assessment parse failed, raw:", text.slice(0, 200));
      return res.status(502).json({ error: "Couldn't generate feedback — try again." });
    }
    recordCall(req.userId!, "assessment", tokensUsed);
    const xp = getUserById(req.userId!)?.xp ?? 0;
    res.json({ assessment, xp });
  } catch (err) {
    console.error("assessment route error:", err);
    res.status(502).json({ error: "Couldn't reach the AI right now. Try again." });
  }
});
