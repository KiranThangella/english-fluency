export interface ChatMessage { role: "user" | "assistant"; content: string; }

export interface ProgressState {
  completedDays: number[];
  speakScores: Record<string, number>;
  weakWords: Record<string, number>;
  sessions: Array<{ day: number; wpm: number; fillers: number; wordCount: number; ts: number }>;
  selectedDay: number;
  darkMode: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  plan: "free" | "premium";
  xp: number;
  nickname: string | null;
  leaderboardOptIn: boolean;
  emailVerified: boolean;
}

const TOKEN_KEY = "ef_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
}

// On web, this stays "" and every request is same-origin relative — behavior
// is unchanged from before. Native builds (Capacitor) have no "same origin"
// to be relative to, so set VITE_API_BASE_URL to your deployed backend URL
// at build time (e.g. `VITE_API_BASE_URL=https://api.yourapp.com npm run build`).
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? "";

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/** fetch wrapper that attaches the auth token and throws the server's real error message on failure. */
async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(apiUrl(path), { ...options, headers });
}

// ---- Auth ----

export async function signup(email: string, password: string): Promise<AuthUser> {
  const res = await authedFetch("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) });
  if (!res.ok) throw new Error(await readError(res, "Sign up failed"));
  const data = await res.json();
  setToken(data.token);
  return data.user as AuthUser;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await authedFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  if (!res.ok) throw new Error(await readError(res, "Login failed"));
  const data = await res.json();
  setToken(data.token);
  return data.user as AuthUser;
}

export async function fetchMe(): Promise<AuthUser | null> {
  if (!getToken()) return null;
  const res = await authedFetch("/api/auth/me");
  if (!res.ok) { clearToken(); return null; }
  const data = await res.json();
  return data.user as AuthUser;
}

export function logout(): void {
  clearToken();
}

export async function forgotPassword(email: string): Promise<string> {
  const res = await authedFetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
  if (!res.ok) throw new Error(await readError(res, "Something went wrong"));
  const data = await res.json();
  return data.message as string;
}

// ---- Analytics ----

export interface AnalyticsSummary {
  totalUsers: number;
  freeUsers: number;
  premiumUsers: number;
  verifiedUsers: number;
  leaderboardOptIns: number;
  signupsLast14Days: { day: string; count: number }[];
  activeUsersLast14Days: { day: string; count: number }[];
  eventCountsLast30Days: { eventType: string; count: number }[];
  day1Retention: number | null;
  day7Retention: number | null;
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const res = await authedFetch("/api/analytics/summary");
  if (!res.ok) throw new Error(await readError(res, "Not authorized"));
  return res.json();
}

export async function resetPassword(token: string, password: string): Promise<AuthUser> {
  const res = await authedFetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
  if (!res.ok) throw new Error(await readError(res, "Couldn't reset password"));
  const data = await res.json();
  setToken(data.token);
  return data.user as AuthUser;
}

export async function verifyEmail(token: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/auth/verify-email?token=${encodeURIComponent(token)}`));
  if (!res.ok) throw new Error(await readError(res, "Couldn't verify email"));
}

export async function resendVerification(): Promise<void> {
  const res = await authedFetch("/api/auth/resend-verification", { method: "POST" });
  if (!res.ok) throw new Error(await readError(res, "Couldn't resend verification email"));
}

// ---- Billing ----

export async function billingStatus(): Promise<{ configured: boolean }> {
  const res = await fetch(apiUrl("/api/billing/status"));
  if (!res.ok) return { configured: false };
  return res.json();
}

export async function startCheckout(): Promise<string> {
  const res = await authedFetch("/api/billing/checkout", { method: "POST" });
  if (!res.ok) throw new Error(await readError(res, "Couldn't start checkout"));
  const data = await res.json();
  return data.url as string;
}

// ---- Progress ----

export async function fetchProgress(): Promise<ProgressState> {
  const res = await authedFetch("/api/progress");
  if (!res.ok) throw new Error(await readError(res, "Failed to load progress"));
  return res.json();
}

export async function saveProgress(patch: Partial<ProgressState>): Promise<ProgressState & { xp?: number }> {
  const res = await authedFetch("/api/progress", { method: "PUT", body: JSON.stringify(patch) });
  if (!res.ok) throw new Error(await readError(res, "Failed to save progress"));
  return res.json();
}

// ---- Chat & grammar ----

export async function sendChatMessage(scenarioId: string, messages: ChatMessage[], customDescription?: string): Promise<{ reply: string; xp: number }> {
  const res = await authedFetch("/api/chat", { method: "POST", body: JSON.stringify({ scenarioId, customDescription, messages }) });
  if (!res.ok) throw new Error(await readError(res, "Chat request failed"));
  return res.json();
}

export async function checkGrammar(sentence: string): Promise<{ result: string; xp: number }> {
  const res = await authedFetch("/api/grammar-check", { method: "POST", body: JSON.stringify({ sentence }) });
  if (!res.ok) throw new Error(await readError(res, "Grammar check failed"));
  return res.json();
}

// ---- Speaking assessment ----

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

export async function assessSpeaking(transcript: string, opts?: { target?: string; prompt?: string }): Promise<{ assessment: AssessmentResult; xp: number }> {
  const res = await authedFetch("/api/assessment", { method: "POST", body: JSON.stringify({ transcript, target: opts?.target, prompt: opts?.prompt }) });
  if (!res.ok) throw new Error(await readError(res, "Couldn't get feedback"));
  return res.json();
}

// ---- Leaderboard ----

export interface LeaderboardEntry { nickname: string; xp: number; }

export async function fetchLeaderboard(): Promise<{ entries: LeaderboardEntry[]; myRank: number | null }> {
  const res = await authedFetch("/api/leaderboard");
  if (!res.ok) throw new Error(await readError(res, "Failed to load leaderboard"));
  return res.json();
}

export async function updateLeaderboardSettings(nickname: string, optIn: boolean): Promise<{ nickname: string | null; leaderboardOptIn: boolean }> {
  const res = await authedFetch("/api/leaderboard/settings", { method: "PUT", body: JSON.stringify({ nickname, optIn }) });
  if (!res.ok) throw new Error(await readError(res, "Failed to update leaderboard settings"));
  return res.json();
}
