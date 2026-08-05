import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, issueSession, setSessionCookie, writeAudit, getRequestMeta } from "@/lib/auth";
import { apiOk, apiError, handleZod, runApi } from "@/lib/api";
import { registerSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail, verifyEmailEmail } from "@/lib/mailer";
import { createVerificationToken } from "@/lib/auth";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function POST(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const ip = getRequestMeta(req).ip;
    const rl = rateLimit(`register:${ip}`, 10, 60_000);
    if (!rl.ok) return apiError(t("api.rateLimited"), 429, "RATE_LIMIT");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(t("api.invalidJson"), 400);
    }
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);
    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findFirst({ where: { email: normalizedEmail } });
    if (existing) return apiError(t("api.emailTaken"), 409, "EMAIL_TAKEN");

    const baseSlug = normalizedEmail.split("@")[0].replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "company";
    let slug = baseSlug;
    let n = 1;
    while (await prisma.company.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${n++}`;
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: `${name}'s Business`, slug, currency: "USD", taxRate: 0.08, industry: null },
      });
      return tx.user.create({
        data: {
          email: normalizedEmail,
          name,
          role: "OWNER",
          passwordHash,
          companyId: company.id,
        },
      });
    });

    const token = await issueSession({ id: user.id, role: user.role, companyId: user.companyId }, req);
    const response = apiOk({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    setSessionCookie(response, token, req);

    const verifyToken = await createVerificationToken(user.id, "EMAIL_VERIFY");
    const origin = req.headers.get("origin") ?? "http://localhost:3000";
    await sendEmail(verifyEmailEmail(normalizedEmail, `${origin}/verify-email?token=${verifyToken}`));

    await writeAudit({
      action: "AUTH.REGISTER",
      companyId: user.companyId,
      userId: user.id,
      entity: "User",
      entityId: user.id,
      req,
    });

    return response;
  }, locale);
}
