import type { NextRequest } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { db, cuid } from "@/lib/db";
import { user as userTable, branch as branchTable } from "@/lib/drizzle/schema";
import { hashPassword, writeAudit, createVerificationToken } from "@/lib/auth";
import { apiError, apiOk, handleZod, requireAdmin, requireSession, runApi } from "@/lib/api";
import { inviteUserSchema } from "@/lib/validators";
import { canManageUsers } from "@/lib/rbac";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";
import { sendEmail, inviteUserEmail } from "@/lib/mailer";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    requireAdmin(session);

    const users = await db
      .select({
        id: userTable.id,
        email: userTable.email,
        name: userTable.name,
        role: userTable.role,
        status: userTable.status,
        emailVerifiedAt: userTable.emailVerifiedAt,
        lastLoginAt: userTable.lastLoginAt,
        createdAt: userTable.createdAt,
        branch: { id: branchTable.id, name: branchTable.name },
      })
      .from(userTable)
      .leftJoin(branchTable, eq(userTable.branchId, branchTable.id))
      .where(eq(userTable.companyId, session.company.id))
      .orderBy(asc(userTable.role), asc(userTable.createdAt));

    return apiOk({ users });
  });
}

export async function POST(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    requireAdmin(session);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(t("api.invalidJson"), 400);
    }
    const parsed = inviteUserSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);
    const { name, email, role, branchId, password } = parsed.data;

    if (!canManageUsers(session.user.role, role)) {
      return apiError(t("api.cannotInviteRole"), 403);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const [existing] = await db.select({ id: userTable.id }).from(userTable).where(and(eq(userTable.companyId, session.company.id), eq(userTable.email, normalizedEmail))).limit(1);
    if (existing) return apiError(t("api.emailTakenCompany"), 409, "EMAIL_TAKEN");

    if (branchId) {
      const [branch] = await db.select({ id: branchTable.id }).from(branchTable).where(and(eq(branchTable.id, branchId), eq(branchTable.companyId, session.company.id))).limit(1);
      if (!branch) return apiError(t("api.branchNotFound"), 400);
    }

    const userId = cuid();
    await db.insert(userTable).values({
      id: userId,
      name,
      email: normalizedEmail,
      role,
      branchId: branchId ?? null,
      passwordHash: await hashPassword(password ?? `${name}@${Math.random().toString(36).slice(2, 8)}`),
      companyId: session.company.id,
    });

    await writeAudit({
      action: "TEAM.INVITE",
      companyId: session.company.id,
      userId: session.user.id,
      entity: "User",
      entityId: userId,
      metadata: { invitedEmail: normalizedEmail, role },
      req,
    });

    const resetToken = await createVerificationToken(userId, "PASSWORD_RESET");
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "https://business-ai.zaiedd.workers.dev";
    await sendEmail(inviteUserEmail(normalizedEmail, `${origin}/reset-password?token=${resetToken}`, session.company.name, locale));

    return apiOk({ user: { id: userId, email: normalizedEmail, name, role } }, { status: 201 });
  }, locale);
}
