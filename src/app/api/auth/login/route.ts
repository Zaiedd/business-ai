import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
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

    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase().trim() }, include: { company: true } });
    if (!user || !user.passwordHash) {
      await new Promise((r) => setTimeout(r, 350)); // mitigate user enumeration timing
      return apiError(t("api.invalidCredentials"), 401, "INVALID_CREDENTIALS");
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return apiError(t("api.invalidCredentials"), 401, "INVALID_CREDENTIALS");

    if (user.status !== "ACTIVE") {
      return apiError(t("api.accountDisabled"), 403, "ACCOUNT_DISABLED");
    }

    const token = await issueSession({ id: user.id, role: user.role, companyId: user.companyId }, req);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const response = apiOk({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: { id: user.company.id, name: user.company.name, slug: user.company.slug, currency: user.company.currency },
      },
    });
    setSessionCookie(response, token, req);

    await writeAudit({
      action: "AUTH.LOGIN",
      companyId: user.companyId,
      userId: user.id,
      entity: "User",
      entityId: user.id,
      req,
    });

    return response;
  }, locale);
}
