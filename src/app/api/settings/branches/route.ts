import type { NextRequest } from "next/server";
import { eq, and, asc, count } from "drizzle-orm";
import { db, cuid } from "@/lib/db";
import { branch as branchTable, user as userTable } from "@/lib/drizzle/schema";
import { writeAudit } from "@/lib/auth";
import { apiError, apiOk, handleZod, requireAdmin, requireSession, runApi } from "@/lib/api";
import { branchSchema } from "@/lib/validators";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    const branches = await db
      .select({ id: branchTable.id, name: branchTable.name, address: branchTable.address, city: branchTable.city, createdAt: branchTable.createdAt })
      .from(branchTable)
      .where(eq(branchTable.companyId, session.company.id))
      .orderBy(asc(branchTable.createdAt));
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

    const [existing] = await db.select({ id: branchTable.id }).from(branchTable).where(and(eq(branchTable.companyId, session.company.id), eq(branchTable.name, parsed.data.name))).limit(1);
    if (existing) return apiError(t("api.branchNameTaken"), 409);

    const branchId = cuid();
    await db.insert(branchTable).values({
      id: branchId,
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      city: parsed.data.city ?? null,
      companyId: session.company.id,
    });

    await writeAudit({
      action: "COMPANY.BRANCH_CREATED",
      companyId: session.company.id,
      userId: session.user.id,
      entity: "Branch",
      entityId: branchId,
      metadata: { name: parsed.data.name },
      req,
    });

    return apiOk({ branch: { id: branchId, name: parsed.data.name, address: parsed.data.address ?? null, city: parsed.data.city ?? null } }, { status: 201 });
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

    const [branch] = await db.select().from(branchTable).where(and(eq(branchTable.id, id), eq(branchTable.companyId, session.company.id))).limit(1);
    if (!branch) return apiError(t("api.branchNotFound"), 404);

    const [usersOnBranch] = await db.select({ c: count() }).from(userTable).where(eq(userTable.branchId, id));
    if (Number(usersOnBranch?.c ?? 0) > 0) {
      return apiError(t("api.reassignBranch"), 400);
    }

    await db.delete(branchTable).where(eq(branchTable.id, id));
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
