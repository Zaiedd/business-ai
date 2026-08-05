import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/auth";
import { apiError, apiOk, handleZod, requireAdmin, requireSession, runApi } from "@/lib/api";
import { branchSchema } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    const branches = await prisma.branch.findMany({
      where: { companyId: session.company.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, address: true, city: true, createdAt: true },
    });
    return apiOk({ branches });
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
    const parsed = branchSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);

    const existing = await prisma.branch.findFirst({ where: { companyId: session.company.id, name: parsed.data.name } });
    if (existing) return apiError(t("api.branchNameTaken"), 409);

    const branch = await prisma.branch.create({
      data: {
        name: parsed.data.name,
        address: parsed.data.address ?? null,
        city: parsed.data.city ?? null,
        companyId: session.company.id,
      },
      select: { id: true, name: true, address: true, city: true },
    });

    await writeAudit({
      action: "COMPANY.BRANCH_CREATED",
      companyId: session.company.id,
      userId: session.user.id,
      entity: "Branch",
      entityId: branch.id,
      metadata: { name: branch.name },
      req,
    });

    return apiOk({ branch }, { status: 201 });
  }, locale);
}

export async function DELETE(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const session = await requireSession(req);
    requireAdmin(session);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return apiError(t("api.missingBranchId"), 400);

    const branch = await prisma.branch.findFirst({ where: { id, companyId: session.company.id } });
    if (!branch) return apiError(t("api.branchNotFound"), 404);

    const usersOnBranch = await prisma.user.count({ where: { branchId: id } });
    if (usersOnBranch > 0) {
      return apiError(t("api.reassignBranch"), 400);
    }

    await prisma.branch.delete({ where: { id } });
    await writeAudit({
      action: "COMPANY.BRANCH_DELETED",
      companyId: session.company.id,
      userId: session.user.id,
      entity: "Branch",
      entityId: id,
      metadata: { name: branch.name },
      req,
    });
    return apiOk({ success: true });
  }, locale);
}
