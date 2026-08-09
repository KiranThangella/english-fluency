import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET;

function getSecret(): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not set. Copy .env.example to .env and set a random secret.");
  }
  return JWT_SECRET;
}

export function newUserId(): string {
  return randomUUID();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ sub: userId, ver: tokenVersion }, getSecret(), { expiresIn: "30d" });
}

export interface TokenPayload {
  userId: string;
  tokenVersion: number;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, getSecret()) as { sub: string; ver?: number };
    return { userId: payload.sub, tokenVersion: payload.ver ?? 0 };
  } catch {
    return null;
  }
}
