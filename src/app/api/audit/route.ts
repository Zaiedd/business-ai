import type { NextRequest } from "next/server";
import { eq, and, desc, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog as auditLogTable, user as userTable } from "@/lib/drizzle/schema";
import { apiOk, requireAdmin, requireSession, runApi } from "@/lib/api";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    requireAdmin(session);

    const logs = await db
      .select({
        id: auditLogTable.id,
        action: auditLogTable.action,
        entity: auditLogTable.entity,
        entityId: auditLogTable.entityId,
        metadata: auditLogTable.metadata,
        ip: auditLogTable.ip,
        createdAt: auditLogTable.createdAt,
        user: { name: userTable.name, email: userTable.email },
      })
      .from(auditLogTable)
      .leftJoin(userTable, eq(auditLogTable.userId, userTable.id))
      .where(eq(auditLogTable.companyId, session.company.id))
      .orderBy(desc(auditLogTable.createdAt))
      .limit(60);

    return apiOk({ logs });
  });
}
