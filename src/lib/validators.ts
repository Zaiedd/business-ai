import { z } from "zod";

export const DATE_RANGES = ["7d", "30d", "90d", "12m"] as const;
export type DateRange = (typeof DATE_RANGES)[number];

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().email("Enter a valid email").max(160),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16, "Invalid reset token"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const inviteUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().email("Enter a valid email").max(160),
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "ACCOUNTANT", "EMPLOYEE"]),
  branchId: z.string().nullable().optional(),
  password: z.string().min(8).max(128).optional(),
});

export const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "ACCOUNTANT", "EMPLOYEE"]),
});

export const updateStatusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "DISABLED"]),
});

export const companySettingsSchema = z.object({
  name: z.string().min(2).max(120),
  currency: z.string().min(3).max(3).toUpperCase(),
  taxRate: z.coerce.number().min(0).max(0.5),
  industry: z.string().max(80).nullable().optional(),
});

export const branchSchema = z.object({
  name: z.string().min(2).max(120),
  address: z.string().max(200).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
});

export const productSchema = z.object({
  name: z.string().min(2).max(120),
  sku: z.string().max(60).nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  costPrice: z.coerce.number().min(0).max(1_000_000_000),
  sellingPrice: z.coerce.number().min(0).max(1_000_000_000),
  stockQty: z.coerce.number().int().min(0).max(1_000_000_000),
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000_000),
});

export const customerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().max(160).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  segment: z.enum(["VIP", "REGULAR", "NEW"]).nullable().optional(),
});

export const saleItemSchema = z.object({
  productId: z.string().min(1),
  qty: z.coerce.number().int().min(1).max(1_000_000),
  unitPrice: z.coerce.number().min(0).max(1_000_000_000),
});

export const saleSchema = z.object({
  branchId: z.string().min(1).nullable().optional(),
  customerId: z.string().min(1).nullable().optional(),
  date: z.coerce.date().optional(),
  discount: z.coerce.number().min(0).max(1_000_000_000).optional(),
  items: z.array(saleItemSchema).min(1),
});

export const saleStatusSchema = z.object({
  status: z.enum(["COMPLETED", "PENDING", "REFUNDED"]),
});
