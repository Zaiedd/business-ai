import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { updateSaleStatus } from "@/server/sales";
import { writeAudit } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  }

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  const bodyText = await req.text();

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(bodyText, signature, webhookSecret);
    } else {
      // Development mode fallback without webhook secret
      event = JSON.parse(bodyText);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Webhook signature verification failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const saleId = session.metadata?.saleId || session.client_reference_id;
    const companyId = session.metadata?.companyId;

    if (saleId && companyId) {
      try {
        await updateSaleStatus(companyId, saleId, "COMPLETED");
        await writeAudit({
          action: "SALES.STRIPE_PAYMENT_SUCCESS",
          companyId,
          entity: "Sale",
          entityId: saleId,
          metadata: {
            stripeSessionId: session.id,
            amountTotal: session.amount_total,
            currency: session.currency,
          },
        });
      } catch (e) {
        console.error("Failed to process webhook for sale:", saleId, e);
      }
    }
  }

  return NextResponse.json({ received: true });
}
