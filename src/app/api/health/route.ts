import { NextResponse } from "next/server";

export async function GET() {
  const checks: {
    status: "ok" | "degraded";
    timestamp: string;
    environment: string;
    database: { configured: boolean; connected: boolean };
    auth: { secretConfigured: boolean; secretIsDefault: boolean };
    stripe: { configured: boolean };
    ai: { configured: boolean };
  } = {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    database: { configured: Boolean(process.env.DATABASE_URL), connected: false },
    auth: {
      secretConfigured: Boolean(process.env.AUTH_SECRET),
      secretIsDefault: process.env.AUTH_SECRET === "insecure-dev-secret-change-me",
    },
    stripe: { configured: Boolean(process.env.STRIPE_SECRET_KEY) },
    ai: { configured: Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_BASE_URL) },
  };

  if (checks.database.configured) {
    try {
      const { db } = await import("@/lib/db");
      const { user } = await import("@/lib/drizzle/schema");
      await db.select({ sub: user.id }).from(user).limit(1);
      checks.database.connected = true;
    } catch {
      checks.database.connected = false;
      checks.status = "degraded";
    }
  } else {
    checks.status = "degraded";
  }

  return NextResponse.json(checks, { status: checks.status === "ok" ? 200 : 503 });
}