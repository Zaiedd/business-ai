import { describe, expect, it } from "vitest";
import {
  branchSchema,
  companySettingsSchema,
  customerSchema,
  loginSchema,
  productSchema,
  registerSchema,
  saleSchema,
} from "@/lib/validators";

describe("Zod Validation Schemas", () => {
  it("registerSchema validates registration inputs", () => {
    const valid = registerSchema.safeParse({
      name: "Ahmed Ali",
      email: "ahmed@example.com",
      password: "Password123!",
    });
    expect(valid.success).toBe(true);

    const shortPassword = registerSchema.safeParse({
      name: "Ahmed",
      email: "ahmed@example.com",
      password: "123",
    });
    expect(shortPassword.success).toBe(false);

    const invalidEmail = registerSchema.safeParse({
      name: "Ahmed",
      email: "invalid-email",
      password: "Password123!",
    });
    expect(invalidEmail.success).toBe(false);
  });

  it("loginSchema validates credentials", () => {
    const valid = loginSchema.safeParse({
      email: "owner@acme.test",
      password: "Password123!",
    });
    expect(valid.success).toBe(true);

    const missingPass = loginSchema.safeParse({
      email: "owner@acme.test",
      password: "",
    });
    expect(missingPass.success).toBe(false);
  });

  it("companySettingsSchema validates business configuration", () => {
    const valid = companySettingsSchema.safeParse({
      name: "Acme Corp",
      currency: "USD",
      taxRate: 0.15,
      industry: "Retail",
    });
    expect(valid.success).toBe(true);

    const invalidTax = companySettingsSchema.safeParse({
      name: "Acme Corp",
      currency: "USD",
      taxRate: 0.8, // > max 0.5
    });
    expect(invalidTax.success).toBe(false);
  });

  it("productSchema validates inventory products", () => {
    const valid = productSchema.safeParse({
      name: "Laptop",
      sku: "LAP-001",
      category: "Electronics",
      costPrice: 500,
      sellingPrice: 800,
      stockQty: 10,
      lowStockThreshold: 2,
    });
    expect(valid.success).toBe(true);

    const negativeStock = productSchema.safeParse({
      name: "Laptop",
      costPrice: 500,
      sellingPrice: 800,
      stockQty: -5,
      lowStockThreshold: 2,
    });
    expect(negativeStock.success).toBe(false);
  });

  it("customerSchema validates customer records", () => {
    const valid = customerSchema.safeParse({
      name: "Sarah Smith",
      email: "sarah@example.com",
      phone: "+1234567890",
      segment: "VIP",
    });
    expect(valid.success).toBe(true);

    const invalidSegment = customerSchema.safeParse({
      name: "Sarah Smith",
      segment: "INVALID_SEGMENT",
    });
    expect(invalidSegment.success).toBe(false);
  });

  it("saleSchema validates transaction creation", () => {
    const valid = saleSchema.safeParse({
      discount: 10,
      items: [
        {
          productId: "prod_1",
          qty: 2,
          unitPrice: 50,
        },
      ],
    });
    expect(valid.success).toBe(true);

    const emptyItems = saleSchema.safeParse({
      items: [],
    });
    expect(emptyItems.success).toBe(false);
  });

  it("branchSchema validates branch creation", () => {
    const valid = branchSchema.safeParse({
      name: "Cairo Main Branch",
      city: "Cairo",
      address: "Tahrir Square",
    });
    expect(valid.success).toBe(true);
  });
});
