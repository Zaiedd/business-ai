import Stripe from "stripe";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { sale as saleTable, saleItem as saleItemTable, product as productTable, customer as customerTable, company as companyTable } from "@/lib/drizzle/schema";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2025-01-27.acacia" as any,
    });
  }
  return stripeInstance;
}

export function getStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

export async function createStripeCheckoutSession({
  saleId,
  companyId,
  origin,
}: {
  saleId: string;
  companyId: string;
  origin: string;
}): Promise<{ url: string | null; sessionId: string }> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in .env");
  }

  const [saleRow] = await db
    .select({
      id: saleTable.id,
      invoiceNo: saleTable.invoiceNo,
      companyId: saleTable.companyId,
      customerEmail: customerTable.email,
      companyName: companyTable.currency,
    })
    .from(saleTable)
    .leftJoin(customerTable, eq(saleTable.customerId, customerTable.id))
    .leftJoin(companyTable, eq(saleTable.companyId, companyTable.id))
    .where(and(eq(saleTable.id, saleId), eq(saleTable.companyId, companyId)))
    .limit(1);

  if (!saleRow) {
    throw new Error("Sale invoice not found");
  }

  const items = await db
    .select({
      name: productTable.name,
      sku: productTable.sku,
      unitPrice: saleItemTable.unitPrice,
      qty: saleItemTable.qty,
    })
    .from(saleItemTable)
    .innerJoin(productTable, eq(saleItemTable.productId, productTable.id))
    .where(eq(saleItemTable.saleId, saleId));

  const currency = (saleRow.companyName || "usd").toLowerCase();

  const lineItems = items.map((item: { name: string; sku: string | null; unitPrice: number; qty: number }) => ({
    price_data: {
      currency,
      product_data: {
        name: item.name,
        description: `SKU: ${item.sku || "N/A"}`,
      },
      unit_amount: Math.round(item.unitPrice * 100),
    },
    quantity: item.qty,
  }));

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: lineItems,
    customer_email: saleRow.customerEmail || undefined,
    client_reference_id: saleRow.id,
    metadata: {
      saleId: saleRow.id,
      invoiceNo: saleRow.invoiceNo,
      companyId: saleRow.companyId,
    },
    success_url: `${origin}/sales?payment=success&invoice=${saleRow.invoiceNo}`,
    cancel_url: `${origin}/sales?payment=cancelled&invoice=${saleRow.invoiceNo}`,
  });

  return { url: session.url, sessionId: session.id };
}
