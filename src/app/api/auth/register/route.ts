import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, cuid, dbRunInTransaction } from "@/lib/db";
import { user as userTable, company as companyTable } from "@/lib/drizzle/schema";
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

    // Check if email already exists
    let existing: { id: string } | undefined;
    try {
      const rows = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, normalizedEmail)).limit(1);
      existing = rows[0];
    } catch (err: any) {
      console.error("[register] failed to check existing email:", err?.message || err);
      return apiError("Database error while checking email", 500, "DB_ERROR");
    }
    if (existing) return apiError(t("api.emailTaken"), 409, "EMAIL_TAKEN");

    // Generate unique slug
    const baseSlug = normalizedEmail.split("@")[0].replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "company";
    let slug = baseSlug;
    let n = 1;
    while (true) {
      let slugExists: { id: string } | undefined;
      try {
        const rows = await db.select({ id: companyTable.id }).from(companyTable).where(eq(companyTable.slug, slug)).limit(1);
        slugExists = rows[0];
      } catch (err: any) {
        console.error("[register] failed to check slug:", err?.message || err);
        return apiError("Database error while generating slug", 500, "DB_ERROR");
      }
      if (!slugExists) break;
      slug = `${baseSlug}-${n++}`;
    }

    // Hash password
    let passwordHash: string;
    try {
      passwordHash = await hashPassword(password);
    } catch (err: any) {
      console.error("[register] password hash failed:", err?.message || err);
      return apiError("Failed to process password", 500, "HASH_ERROR");
    }

    // Create company + user in a single HTTP transaction (neon-http has no db.transaction)
    let result: { userId: string; companyId: string; role: "OWNER" };
    try {
      const companyId = cuid();
      const userId = cuid();
      await dbRunInTransaction([
        db.insert(companyTable).values({
          id: companyId,
          name: `${name}'s Business`,
          slug,
          currency: "USD",
          taxRate: 0.08,
        }).toSQL(),
        db.insert(userTable).values({
          id: userId,
          email: normalizedEmail,
          name,
          role: "OWNER",
          passwordHash,
          companyId,
        }).toSQL(),
      ]);
      result = { userId, companyId, role: "OWNER" as const };
    } catch (err: any) {
      console.error("[register] transaction failed:", err?.message || err, err?.stack);
      // Try to give more specific error
      const msg = err?.message?.toLowerCase() || "";
      if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("constraint")) {
        return apiError("Email or company already exists", 409, "DUPLICATE");
      }
      if (msg.includes("connection") || msg.includes("timeout") || msg.includes("network")) {
        return apiError("Database connection error. Please try again later.", 503, "DB_UNAVAILABLE");
      }
      return apiError("Failed to create account. Please try again.", 500, "TRANSACTION_ERROR");
    }

    // Issue session token
    let token: string;
    try {
      token = await issueSession({ id: result.userId, role: result.role, companyId: result.companyId }, req);
    } catch (err: any) {
      console.error("[register] session creation failed:", err?.message || err);
      return apiError("Failed to create session", 500, "SESSION_ERROR");
    }

    // Update last login
    try {
      await db.update(userTable).set({ lastLoginAt: new Date() }).where(eq(userTable.id, result.userId));
    } catch (err: any) {
      console.error("[register] update lastLoginAt failed (non-fatal):", err?.message || err);
      // Non-fatal, continue
    }

    const response = apiOk({
      user: {
        id: result.userId,
        name,
        email: normalizedEmail,
        role: result.role,
      },
    });
    setSessionCookie(response, token, req);

    // Create verification token and send email
    let verifyToken: string;
    try {
      verifyToken = await createVerificationToken(result.userId, "EMAIL_VERIFY");
    } catch (err: any) {
      console.error("[register] verification token failed:", err?.message || err);
      return apiError("Failed to create verification", 500, "VERIFY_ERROR");
    }

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "https://business-ai.zaiedd.workers.dev";
    try {
      await sendEmail(verifyEmailEmail(normalizedEmail, `${origin}/verify-email?token=${verifyToken}`, locale));
    } catch (err: any) {
      console.error("[register] email send failed (non-fatal):", err?.message || err);
      // Non-fatal — account created, just email failed
    }

    // Audit log
    try {
      await writeAudit({
        action: "AUTH.REGISTER",
        companyId: result.companyId,
        userId: result.userId,
        entity: "User",
        entityId: result.userId,
        req,
      });
    } catch (err: any) {
      console.error("[register] audit log failed (non-fatal):", err?.message || err);
    }

    return response;
  }, locale);
}
