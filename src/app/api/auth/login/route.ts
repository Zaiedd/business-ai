import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/drizzle/schema";
import { verifyPassword, issueSession, setSessionCookie, writeAudit, getRequestMeta } from "@/lib/auth";
import { apiOk, apiError, handleZod, runApi } from "@/lib/api";
import { loginSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function POST(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const ip = getRequestMeta(req).ip;
    const rl = rateLimit(`login:${ip}`, 20, 60_000);
    if (!rl.ok) return apiError(t("api.rateLimited"), 429, "RATE_LIMIT");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(t("api.invalidJson"), 400);
    }
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);
    const { email, password } = parsed.data;

    let userRow;
    try {
      const [found] = await db.select().from(userTable).where(eq(userTable.email, email.toLowerCase().trim())).limit(1);
      userRow = found;
    } catch (dbErr: any) {
      return apiError(`DB_ERROR: ${dbErr?.message ?? String(dbErr)} | cause: ${dbErr?.cause?.message ?? "none"}`, 500, "DB_ERROR");
    }
    if (!userRow || !userRow.passwordHash) {
      await new Promise((r) => setTimeout(r, 350));
      return apiError(t("api.invalidCredentials"), 401, "INVALID_CREDENTIALS");
    }

    const ok = await verifyPassword(password, userRow.passwordHash);
    if (!ok) return apiError(t("api.invalidCredentials"), 401, "INVALID_CREDENTIALS");

    if (userRow.status !== "ACTIVE") {
      return apiError(t("api.accountDisabled"), 403, "ACCOUNT_DISABLED");
    }

    // Fetch company info
    const { company: companyTable } = await import("@/lib/drizzle/schema");
    const [company] = await db.select().from(companyTable).where(eq(companyTable.id, userRow.companyId)).limit(1);

    const token = await issueSession({ id: userRow.id, role: userRow.role, companyId: userRow.companyId }, req);
    await db.update(userTable).set({ lastLoginAt: new Date() }).where(eq(userTable.id, userRow.id));

    const response = apiOk({
      user: {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        role: userRow.role,
        company: company ? { id: company.id, name: company.name, slug: company.slug, currency: company.currency } : null,
      },
    });
    setSessionCookie(response, token, req);

    await writeAudit({
      action: "AUTH.LOGIN",
      companyId: userRow.companyId,
      userId: userRow.id,
      entity: "User",
      entityId: userRow.id,
      req,
    });

    return response;
  }, locale);
}
