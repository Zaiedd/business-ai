import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, writeAudit } from "@/lib/auth";
import { apiError, apiOk, handleZod, requireAdmin, requireSession, runApi } from "@/lib/api";
import { inviteUserSchema } from "@/lib/validators";
import { canManageUsers } from "@/lib/rbac";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    requireAdmin(session);
    const users = await prisma.user.findMany({
      where: { companyId: session.company.id },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
      },
    });
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
    const existing = await prisma.user.findUnique({ where: { companyId_email: { companyId: session.company.id, email: normalizedEmail } } });
    if (existing) return apiError(t("api.emailTakenCompany"), 409, "EMAIL_TAKEN");

    if (branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: branchId, companyId: session.company.id } });
      if (!branch) return apiError(t("api.branchNotFound"), 400);
    }

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        role,
        branchId: branchId ?? null,
        passwordHash: await hashPassword(password ?? `${name}@${Math.random().toString(36).slice(2, 8)}`),
        companyId: session.company.id,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    await writeAudit({
      action: "TEAM.INVITE",
      companyId: session.company.id,
      userId: session.user.id,
      entity: "User",
      entityId: user.id,
      metadata: { invitedEmail: user.email, role },
      req,
    });

    return apiOk({ user }, { status: 201 });
  }, locale);
}
