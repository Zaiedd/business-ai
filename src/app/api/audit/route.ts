import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiOk, requireAdmin, requireSession, runApi } from "@/lib/api";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    requireAdmin(session);

    const logs = await prisma.auditLog.findMany({
      where: { companyId: session.company.id },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        metadata: true,
        ip: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    });
    return apiOk({ logs });
  });
}
