import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays } from "@/lib/utils";
import { SESSION_COOKIE, signSessionToken, verifySessionToken, SESSION_TTL_SECONDS } from "@/lib/session-token";
import type { SessionClaims } from "@/lib/session-token";

export { SESSION_COOKIE, SESSION_TTL_SECONDS };
export type { SessionClaims };

// ---------------------------------------------------------------------------
// Password hashing (bcrypt — zero native deps, runs everywhere)
// ---------------------------------------------------------------------------
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---------------------------------------------------------------------------
// Request metadata
// ---------------------------------------------------------------------------
export function getRequestMeta(req: NextRequest | Request) {
  const raw =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const ip = raw.split(",")[0].trim();
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const device = /mobile/i.test(userAgent) ? "Mobile" : /tablet/i.test(userAgent) ? "Tablet" : "Desktop";
  return { ip, userAgent, device };
}

export interface SessionContext {
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    status: string;
    companyId: string;
    branchId: string | null;
  };
  company: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    taxRate: number;
    industry: string | null;
  };
  branch: { id: string; name: string } | null;
  token: string;
}

export async function issueSession(
  user: { id: string; role: Role; companyId: string },
  req: NextRequest | Request,
): Promise<string> {
  const token = await signSessionToken({ sub: user.id, role: user.role, companyId: user.companyId });
  const meta = getRequestMeta(req);
  await prisma.session.create({
    data: {
      token,
      userId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      device: meta.device,
      expiresAt: addDays(new Date(), 30),
    },
  });
  return token;
}

function isLocalHost(req?: NextRequest | Request | null): boolean {
  if (!req) return false;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function setSessionCookie(
  response: { cookies: { set: (name: string, value: string, opts: object) => void } },
  token: string,
  req?: NextRequest | Request,
) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !isLocalHost(req),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(
  response: { cookies: { set: (name: string, value: string, opts: object) => void } },
  req?: NextRequest | Request,
) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !isLocalHost(req),
    path: "/",
    maxAge: 0,
  });
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.session.updateMany({ where: { token }, data: { revokedAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Current session
// ---------------------------------------------------------------------------
export async function getSession(req?: NextRequest): Promise<SessionContext | null> {
  const token = req ? req.cookies.get(SESSION_COOKIE)?.value : (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims?.sub) return null;

  const session = await prisma.session.findUnique({ where: { token } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { company: true, branch: true },
  });
  if (!user || user.status !== "ACTIVE") return null;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      companyId: user.companyId,
      branchId: user.branchId,
    },
    company: {
      id: user.company.id,
      name: user.company.name,
      slug: user.company.slug,
      currency: user.company.currency,
      taxRate: user.company.taxRate,
      industry: user.company.industry,
    },
    branch: user.branch ? { id: user.branch.id, name: user.branch.name } : null,
    token,
  };
}

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------
export async function writeAudit(
  input: {
    action: string;
    companyId: string;
    userId?: string | null;
    entity?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    req?: NextRequest | Request | null;
  },
): Promise<void> {
  const meta = input.req ? getRequestMeta(input.req) : { ip: null, userAgent: null };
  await prisma.auditLog.create({
    data: {
      action: input.action,
      companyId: input.companyId,
      userId: input.userId ?? null,
      entity: input.entity ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
  });
}

// ---------------------------------------------------------------------------
// Verification tokens (email verify + password reset)
// ---------------------------------------------------------------------------
export async function createVerificationToken(userId: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET", ttlHours = 24): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: { token, userId, type, expiresAt: addDays(new Date(), ttlHours / 24) },
  });
  return token;
}

export async function consumeVerificationToken(token: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET"): Promise<string | null> {
  const vt = await prisma.verificationToken.findUnique({ where: { token } });
  if (!vt || vt.type !== type || vt.usedAt || vt.expiresAt < new Date()) return null;
  await prisma.verificationToken.update({ where: { id: vt.id }, data: { usedAt: new Date() } });
  return vt.userId;
}
