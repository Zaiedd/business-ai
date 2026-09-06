import { NextRequest } from "next/server";
import { apiError, apiOk, requireSession, runApi } from "@/lib/api";
import { createStripeCheckoutSession, getStripeEnabled } from "@/lib/stripe";
import { getLocaleFromRequest, serverT } from "@/lib/i18n/server";

export async function POST(req: NextRequest) {
  const locale = getLocaleFromRequest(req);
  const t = serverT(locale);

  return runApi(async () => {
    const session = await requireSession(req);

    if (!getStripeEnabled()) {
      return apiError(
        isArabic(locale)
          ? "خدمة الدفع الإلكتروني عبر Stripe غير مفعلة حالياً."
          : "Stripe payment gateway is not configured.",
        400,
        "STRIPE_DISABLED"
      );
    }

    let body: { saleId?: string };
    try {
      body = await req.json();
    } catch {
      return apiError(t("api.invalidJson"), 400);
    }

    if (!body.saleId) {
      return apiError(t("api.missingId"), 400);
    }

    const origin = req.headers.get("origin") || req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || "https://business-ai.zaiedd.workers.dev";

    try {
      const { url, sessionId } = await createStripeCheckoutSession({
        saleId: body.saleId,
        companyId: session.company.id,
        origin,
      });

      return apiOk({ url, sessionId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create checkout session";
      return apiError(message, 500);
    }
  }, locale);
}

function isArabic(locale: string): boolean {
  return locale === "ar";
}
