import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ZodError } from "zod";
import { getSession, writeAudit } from "@/lib/auth";
import type { SessionContext } from "@/lib/auth";
import { serverT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n";

export function apiOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function apiError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export function handleZod(e: unknown, locale?: Locale) {
  if (e instanceof ZodError) {
    const t = locale ? serverT(locale) : null;
    return apiError(t?.(`api.invalidInput`) ?? e.errors[0]?.message ?? "Invalid input", 422, "VALIDATION");
  }
  console.error(e);
  return apiError("Unexpected server error", 500, "INTERNAL");
}

export async function requireSession(req?: NextRequest): Promise<SessionContext> {
  const session = await getSession(req);
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

export function requireAdmin(session: SessionContext) {
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN") {
    throw new ForbiddenError();
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
  }
}

export async function runApi(handler: () => Promise<Response>, locale?: Locale): Promise<Response> {
  const t = locale ? serverT(locale) : null;
  try {
    return await handler();
  } catch (e) {
    if (e instanceof UnauthorizedError) return apiError(t?.(`api.unauthorized`) ?? "Authentication required", 401, "UNAUTHORIZED");
    if (e instanceof ForbiddenError) return apiError(t?.(`api.forbidden`) ?? "You do not have permission to perform this action", 403, "FORBIDDEN");
    console.error(e);
    return apiError(t?.(`api.unexpected`) ?? "Unexpected server error", 500, "INTERNAL");
  }
}

export function escapeCsv(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function audit(session: SessionContext, action: string, extra?: { entity?: string; entityId?: string; metadata?: Record<string, unknown>; req?: NextRequest | Request | null }) {
  await writeAudit({
    action,
    companyId: session.company.id,
    userId: session.user.id,
    entity: extra?.entity,
    entityId: extra?.entityId,
    metadata: extra?.metadata,
    req: extra?.req,
  });
}
