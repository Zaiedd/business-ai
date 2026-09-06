import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/auth";

// Edge-safe session token helpers (jose only — no database, no node-only deps).
// Imported by both middleware (edge runtime) and server code (node runtime).

export const SESSION_COOKIE = "bsai_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const rawSecret = process.env.AUTH_SECRET;
if (!rawSecret || rawSecret === "insecure-dev-secret-change-me") {
  console.warn(
    "[Session] AUTH_SECRET is not configured or using default value. " +
    "Set a strong secret in Cloudflare Dashboard → Workers → business-ai → Settings → Variables"
  );
}
const secret = new TextEncoder().encode(
  rawSecret ?? "insecure-dev-secret-change-me",
);

export interface SessionClaims {
  sub: string; // user id
  role: Role;
  companyId: string;
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role, companyId: claims.companyId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + SESSION_TTL_SECONDS * 1000))
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      role: payload.role as Role,
      companyId: payload.companyId as string,
    };
  } catch {
    return null;
  }
}
