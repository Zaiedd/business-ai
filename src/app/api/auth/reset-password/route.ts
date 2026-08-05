import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createVerificationToken, getRequestMeta } from "@/lib/auth";
import { apiOk, apiError, handleZod, runApi } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail, resetPasswordEmail } from "@/lib/mailer";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function POST(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);
  return runApi(async () => {
    const ip = getRequestMeta(req).ip;
    const rl = rateLimit(`reset:${ip}`, 5, 60_000);
    if (!rl.ok) return apiError(t("api.rateLimited"), 429, "RATE_LIMIT");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(t("api.invalidJson"), 400);
    }
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) return handleZod(parsed.error, locale);
    const { email } = parsed.data;

    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase().trim() } });
    if (user) {
      const token = await createVerificationToken(user.id, "PASSWORD_RESET");
      const origin = req.headers.get("origin") ?? "http://localhost:3000";
      const link = `${origin}/reset-password?token=${token}`;
      await sendEmail(resetPasswordEmail(user.email, link));
      // Echo the link in dev so the flow works without SMTP.
      if (process.env.NODE_ENV !== "production") {
        return apiOk({ sent: true, devResetLink: link });
      }
    }

    // Always return the same shape to avoid leaking whether an account exists.
    return apiOk({ sent: true });
  }, locale);
}
