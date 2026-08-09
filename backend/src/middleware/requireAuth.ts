import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../auth.js";
import { getUserById } from "../db.js";

// Augment Express's Request so downstream routes can read req.userId with types.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Not signed in." });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Session expired — please sign in again." });
  }

  // Reject tokens issued before the user's last password reset / forced
  // logout — this is what makes bumpTokenVersion() actually revoke sessions,
  // since JWTs otherwise stay valid until they naturally expire.
  const user = getUserById(payload.userId);
  if (!user || user.token_version !== payload.tokenVersion) {
    return res.status(401).json({ error: "Session expired — please sign in again." });
  }

  req.userId = payload.userId;
  next();
}
