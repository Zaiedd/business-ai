import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/drizzle/schema";
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

    const [userRow] = await db.select().from(userTable).where(eq(userTable.email, email.toLowerCase().trim())).limit(1);
    if (userRow) {
      const token = await createVerificationToken(userRow.id, "PASSWORD_RESET");
      const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "https://business-ai.zaiedd.workers.dev";
      const link = `${origin}/reset-password?token=${token}`;
      await sendEmail(resetPasswordEmail(userRow.email, link, locale));
      if (process.env.NODE_ENV !== "production") {
        return apiOk({ sent: true, devResetLink: link });
      }
    }

    return apiOk({ sent: true });
  }, locale);
}
