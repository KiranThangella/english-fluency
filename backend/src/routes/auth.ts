import { Router } from "express";
import {
  createUser, getUserByEmail, getUserById, setPasswordHash, markEmailVerified,
  createAuthToken, consumeAuthToken, bumpTokenVersion, logEvent, type UserRow,
} from "../db.js";
import { hashPassword, verifyPassword, signToken, newUserId } from "../auth.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { sendEmail } from "../emailSender.js";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APP_URL = process.env.APP_URL ?? "http://localhost:5173";
const RESET_TTL_MINUTES = 60;
const VERIFY_TTL_MINUTES = 60 * 24; // 24h — less urgent than a password reset

function publicUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    plan: u.plan,
    xp: u.xp,
    nickname: u.nickname,
    leaderboardOptIn: !!u.leaderboard_opt_in,
    emailVerified: !!u.email_verified,
  };
}

async function sendVerificationEmail(user: UserRow) {
  const token = createAuthToken(user.id, "verify", VERIFY_TTL_MINUTES);
  const link = `${APP_URL}?verify=${token}`;
  await sendEmail(
    user.email,
    "Verify your email — English Fluency Trail",
    `<p>Welcome! Click below to verify your email address:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`
  );
}

// POST /api/auth/signup  { email, password }
authRouter.post("/signup", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const cleanEmail = (email ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (getUserByEmail(cleanEmail)) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await hashPassword(password);
  const user = createUser(newUserId(), cleanEmail, passwordHash);
  const token = signToken(user.id, user.token_version);
  logEvent(user.id, "signup");

  sendVerificationEmail(user).catch((err) => console.error("verification email failed:", err));

  res.status(201).json({ token, user: publicUser(user) });
});

// POST /api/auth/login  { email, password }
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const cleanEmail = (email ?? "").trim().toLowerCase();

  const user = getUserByEmail(cleanEmail);
  // Same generic message whether the email doesn't exist or the password is
  // wrong — don't leak which emails have accounts.
  if (!user || !password || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }

  const token = signToken(user.id, user.token_version);
  logEvent(user.id, "login");
  res.json({ token, user: publicUser(user) });
});

// GET /api/auth/me — returns the signed-in user, so the frontend can restore
// a session from a stored token without re-sending the password.
authRouter.get("/me", requireAuth, (req, res) => {
  const user = getUserById(req.userId!);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user: publicUser(user) });
});

// POST /api/auth/forgot-password  { email }
// Always returns the same generic response whether or not the email exists,
// so this endpoint can't be used to check which emails have accounts.
authRouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  const cleanEmail = (email ?? "").trim().toLowerCase();
  const user = getUserByEmail(cleanEmail);

  if (user) {
    const token = createAuthToken(user.id, "reset", RESET_TTL_MINUTES);
    const link = `${APP_URL}?reset=${token}`;
    sendEmail(
      user.email,
      "Reset your password — English Fluency Trail",
      `<p>Click below to set a new password. This link expires in ${RESET_TTL_MINUTES} minutes.</p><p><a href="${link}">${link}</a></p><p>If you didn't request this, you can ignore this email.</p>`
    ).catch((err) => console.error("reset email failed:", err));
  }

  res.json({ message: "If that email has an account, a reset link is on its way." });
});

// POST /api/auth/reset-password  { token, password }
authRouter.post("/reset-password", async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  const userId = token ? consumeAuthToken(token, "reset") : null;
  if (!userId) {
    return res.status(400).json({ error: "That reset link is invalid or has expired — request a new one." });
  }

  setPasswordHash(userId, await hashPassword(password));
  bumpTokenVersion(userId); // revoke every previously-issued token — a leaked old token is now dead

  // Sign the user in immediately so they land back in the app, not another login screen.
  const user = getUserById(userId)!;
  const authToken = signToken(userId, user.token_version);
  res.json({ token: authToken, user: publicUser(user) });
});

// GET /api/auth/verify-email?token=...
authRouter.get("/verify-email", (req, res) => {
  const token = req.query.token as string | undefined;
  const userId = token ? consumeAuthToken(token, "verify") : null;
  if (!userId) {
    return res.status(400).json({ error: "That verification link is invalid or has expired." });
  }
  markEmailVerified(userId);
  res.json({ verified: true });
});

// POST /api/auth/resend-verification
authRouter.post("/resend-verification", requireAuth, async (req, res) => {
  const user = getUserById(req.userId!);
  if (!user) return res.status(404).json({ error: "User not found." });
  if (user.email_verified) return res.json({ message: "Already verified." });

  await sendVerificationEmail(user);
  res.json({ message: "Verification email sent." });
});
