export interface DiffToken { word: string; matched: boolean; }
export interface DiffResult { tokens: DiffToken[]; missed: string[]; score: number; }

export const FILLER_RE = /\b(um+|uh+|erm+|you know|i mean)\b/gi;

export function normalizeWords(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s']/g, "").split(/\s+/).filter(Boolean);
}

/** Word-level LCS diff between a target sentence and what was actually said/typed. */
export function diffWords(target: string, spoken: string): DiffResult {
  const t = normalizeWords(target);
  const s = normalizeWords(spoken);
  const dp: number[][] = Array.from({ length: t.length + 1 }, () => new Array(s.length + 1).fill(0));
  for (let i = 1; i <= t.length; i++) {
    for (let j = 1; j <= s.length; j++) {
      dp[i][j] = t[i - 1] === s[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  let i = t.length, j = s.length;
  const matchedT = new Array(t.length).fill(false);
  while (i > 0 && j > 0) {
    if (t[i - 1] === s[j - 1]) { matchedT[i - 1] = true; i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
  }
  const matchedCount = matchedT.filter(Boolean).length;
  const score = t.length ? Math.round((matchedCount / t.length) * 100) : 0;
  return {
    tokens: t.map((w, idx) => ({ word: w, matched: matchedT[idx] })),
    missed: t.filter((w, idx) => !matchedT[idx]),
    score,
  };
}

// The Web Speech API isn't in the TS DOM lib by default — declare the bits we use.
type SpeechRecognitionCtor = new () => any;

export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function speak(text: string): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.92;
  window.speechSynthesis.speak(u);
}
