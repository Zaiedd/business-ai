import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db, cuid } from "@/lib/db";
import { session, user as userTable, auditLog, verificationToken, company as companyTable, branch as branchTable } from "@/lib/drizzle/schema";
import { addDays } from "@/lib/utils";
import { SESSION_COOKIE, signSessionToken, verifySessionToken, SESSION_TTL_SECONDS } from "@/lib/session-token";
import type { SessionClaims } from "@/lib/session-token";

export type { SessionClaims };

// Re-export Role type for compatibility (previously from Prisma)
export type Role = "OWNER" | "ADMIN" | "MANAGER" | "ACCOUNTANT" | "EMPLOYEE";
export type SaleStatus = "COMPLETED" | "PENDING" | "REFUNDED";

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
  userRow: { id: string; role: Role; companyId: string },
  req: NextRequest | Request,
): Promise<string> {
  const token = await signSessionToken({ sub: userRow.id, role: userRow.role, companyId: userRow.companyId });
  const meta = getRequestMeta(req);
  await db.insert(session).values({
    id: cuid(),
    token,
    userId: userRow.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    device: meta.device,
    expiresAt: addDays(new Date(), 30),
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
  await db.update(session).set({ revokedAt: new Date() }).where(eq(session.token, token));
}

// ---------------------------------------------------------------------------
// Current session
// ---------------------------------------------------------------------------
export async function getSession(req?: NextRequest): Promise<SessionContext | null> {
  const token = req ? req.cookies.get(SESSION_COOKIE)?.value : (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims?.sub) return null;

  const [sessionRow] = await db.select().from(session).where(eq(session.token, token)).limit(1);
  if (!sessionRow || sessionRow.revokedAt || sessionRow.expiresAt < new Date()) return null;

  const [userRow] = await db
    .select({
      id: userTable.id,
      email: userTable.email,
      name: userTable.name,
      role: userTable.role,
      status: userTable.status,
      companyId: userTable.companyId,
      branchId: userTable.branchId,
      // Company fields
      company: {
        id: userTable.companyId,
      },
      branch: {
        id: userTable.branchId,
      },
    })
    .from(userTable)
    .where(eq(userTable.id, sessionRow.userId))
    .limit(1);

  if (!userRow || userRow.status !== "ACTIVE") return null;

  // Fetch company and branch details separately
  const [companyRow] = await db.select().from(companyTable).where(eq(companyTable.id, userRow.companyId)).limit(1);
  if (!companyRow) return null;

  let branchRow: { id: string; name: string } | null = null;
  if (userRow.branchId) {
    const [b] = await db.select({ id: branchTable.id, name: branchTable.name }).from(branchTable).where(eq(branchTable.id, userRow.branchId)).limit(1);
    branchRow = b ?? null;
  }

  return {
    user: {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
      status: userRow.status,
      companyId: userRow.companyId,
      branchId: userRow.branchId,
    },
    company: {
      id: companyRow.id,
      name: companyRow.name,
      slug: companyRow.slug,
      currency: companyRow.currency,
      taxRate: companyRow.taxRate,
      industry: companyRow.industry,
    },
    branch: branchRow,
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
  await db.insert(auditLog).values({
    id: cuid(),
    action: input.action,
    companyId: input.companyId,
    userId: input.userId ?? null,
    entity: input.entity ?? null,
    entityId: input.entityId ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

// ---------------------------------------------------------------------------
// Verification tokens (email verify + password reset)
// ---------------------------------------------------------------------------
export async function createVerificationToken(userId: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET", ttlHours = 24): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.insert(verificationToken).values({
    id: cuid(),
    token,
    userId,
    type,
    expiresAt: addDays(new Date(), ttlHours / 24),
  });
  return token;
}

export async function consumeVerificationToken(tokenStr: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET"): Promise<string | null> {
  const [vt] = await db.select().from(verificationToken).where(eq(verificationToken.token, tokenStr)).limit(1);
  if (!vt || vt.type !== type || vt.usedAt || vt.expiresAt < new Date()) return null;
  await db.update(verificationToken).set({ usedAt: new Date() }).where(eq(verificationToken.id, vt.id));
  return vt.userId;
}
