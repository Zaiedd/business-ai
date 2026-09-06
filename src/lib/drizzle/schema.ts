import { pgTable, text, timestamp, integer, real, uniqueIndex, index, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ──────────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("Role", ["OWNER", "ADMIN", "MANAGER", "ACCOUNTANT", "EMPLOYEE"]);
export const saleStatusEnum = pgEnum("SaleStatus", ["COMPLETED", "PENDING", "REFUNDED"]);

// ── Company ────────────────────────────────────────────────────────────────────
export const company = pgTable("Company", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  industry: text("industry"),
  currency: text("currency").notNull().default("USD"),
  taxRate: real("taxRate").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// ── Branch ─────────────────────────────────────────────────────────────────────
export const branch = pgTable("Branch", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  companyId: text("companyId").notNull().references(() => company.id, { onDelete: "cascade" }),
}, (t) => [
  uniqueIndex("Branch_companyId_name_key").on(t.companyId, t.name),
]);

// ── User ───────────────────────────────────────────────────────────────────────
export const user = pgTable("User", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("passwordHash"),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("EMPLOYEE"),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  image: text("image"),
  lastLoginAt: timestamp("lastLoginAt"),
  status: text("status").notNull().default("ACTIVE"),
  locale: text("locale").notNull().default("en"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  companyId: text("companyId").notNull().references(() => company.id, { onDelete: "cascade" }),
  branchId: text("branchId").references(() => branch.id),
}, (t) => [
  uniqueIndex("User_companyId_email_key").on(t.companyId, t.email),
  index("User_email_idx").on(t.email),
]);

// ── Session ────────────────────────────────────────────────────────────────────
export const session = pgTable("Session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  ip: text("ip"),
  userAgent: text("userAgent"),
  device: text("device"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  revokedAt: timestamp("revokedAt"),
}, (t) => [
  index("Session_userId_idx").on(t.userId),
  index("Session_expiresAt_idx").on(t.expiresAt),
]);

// ── VerificationToken ──────────────────────────────────────────────────────────
export const verificationToken = pgTable("VerificationToken", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  type: text("type").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (t) => [
  index("VerificationToken_userId_idx").on(t.userId),
]);

// ── Product ────────────────────────────────────────────────────────────────────
export const product = pgTable("Product", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku"),
  category: text("category"),
  costPrice: real("costPrice").notNull(),
  sellingPrice: real("sellingPrice").notNull(),
  stockQty: integer("stockQty").notNull().default(0),
  lowStockThreshold: integer("lowStockThreshold").notNull().default(10),
  companyId: text("companyId").notNull().references(() => company.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (t) => [
  index("Product_companyId_idx").on(t.companyId),
]);

// ── Customer ───────────────────────────────────────────────────────────────────
export const customer = pgTable("Customer", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  segment: text("segment"),
  loyaltyPoints: integer("loyaltyPoints").notNull().default(0),
  totalSpent: real("totalSpent").notNull().default(0),
  totalOrders: integer("totalOrders").notNull().default(0),
  lastPurchaseAt: timestamp("lastPurchaseAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  companyId: text("companyId").notNull().references(() => company.id, { onDelete: "cascade" }),
}, (t) => [
  index("Customer_companyId_idx").on(t.companyId),
]);

// ── Sale ───────────────────────────────────────────────────────────────────────
export const sale = pgTable("Sale", {
  id: text("id").primaryKey(),
  invoiceNo: text("invoiceNo").notNull(),
  date: timestamp("date").notNull(),
  subtotal: real("subtotal").notNull(),
  discount: real("discount").notNull().default(0),
  tax: real("tax").notNull().default(0),
  total: real("total").notNull(),
  status: saleStatusEnum("status").notNull().default("COMPLETED"),
  companyId: text("companyId").notNull().references(() => company.id, { onDelete: "cascade" }),
  branchId: text("branchId").references(() => branch.id),
  userId: text("userId").references(() => user.id),
  customerId: text("customerId").references(() => customer.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (t) => [
  index("Sale_companyId_date_idx").on(t.companyId, t.date),
  index("Sale_companyId_status_idx").on(t.companyId, t.status),
]);

// ── SaleItem ───────────────────────────────────────────────────────────────────
export const saleItem = pgTable("SaleItem", {
  id: text("id").primaryKey(),
  saleId: text("saleId").notNull().references(() => sale.id, { onDelete: "cascade" }),
  productId: text("productId").notNull().references(() => product.id),
  qty: integer("qty").notNull(),
  unitPrice: real("unitPrice").notNull(),
  costPrice: real("costPrice").notNull(),
  total: real("total").notNull(),
}, (t) => [
  index("SaleItem_productId_idx").on(t.productId),
]);

// ── Expense ────────────────────────────────────────────────────────────────────
export const expense = pgTable("Expense", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  description: text("description"),
  amount: real("amount").notNull(),
  date: timestamp("date").notNull(),
  companyId: text("companyId").notNull().references(() => company.id, { onDelete: "cascade" }),
  branchId: text("branchId").references(() => branch.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (t) => [
  index("Expense_companyId_date_idx").on(t.companyId, t.date),
]);

// ── AuditLog ───────────────────────────────────────────────────────────────────
export const auditLog = pgTable("AuditLog", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: text("entityId"),
  metadata: text("metadata"),
  ip: text("ip"),
  userAgent: text("userAgent"),
  companyId: text("companyId").notNull().references(() => company.id, { onDelete: "cascade" }),
  userId: text("userId").references(() => user.id),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (t) => [
  index("AuditLog_companyId_createdAt_idx").on(t.companyId, t.createdAt),
]);

// ── CompanyFile ────────────────────────────────────────────────────────────────
export const companyFile = pgTable("CompanyFile", {
  id: text("id").primaryKey(),
  originalName: text("originalName").notNull(),
  storedName: text("storedName").notNull().unique(),
  mimeType: text("mimeType").notNull(),
  ext: text("ext").notNull(),
  size: integer("size").notNull(),
  analysis: text("analysis"),
  data: text("data"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  companyId: text("companyId").notNull().references(() => company.id, { onDelete: "cascade" }),
  uploadedById: text("uploadedById").notNull().references(() => user.id),
}, (t) => [
  index("CompanyFile_companyId_createdAt_idx").on(t.companyId, t.createdAt),
]);

// ── AppReport (report history snapshots) ──────────────────────────────────────
export const appReport = pgTable("AppReport", {
  id: text("id").primaryKey(),
  type: text("type").notNull().default("health"),
  period: text("period").notNull().default("30d"),
  customDays: integer("customDays"),
  title: text("title").notNull(),
  headlineScore: real("headlineScore"),
  headlineStatus: text("headlineStatus"),
  summary: text("summary"),
  data: text("data"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  companyId: text("companyId").notNull().references(() => company.id, { onDelete: "cascade" }),
  createdById: text("createdById").notNull().references(() => user.id),
}, (t) => [
  index("AppReport_companyId_createdAt_idx").on(t.companyId, t.createdAt),
]);

// ── Relations ──────────────────────────────────────────────────────────────────
export const companyRelations = relations(company, ({ many }) => ({
  users: many(user),
  branches: many(branch),
  products: many(product),
  customers: many(customer),
  sales: many(sale),
  expenses: many(expense),
  auditLogs: many(auditLog),
  files: many(companyFile),
  reports: many(appReport),
}));

export const branchRelations = relations(branch, ({ one, many }) => ({
  company: one(company, { fields: [branch.companyId], references: [company.id] }),
  users: many(user),
  sales: many(sale),
  expenses: many(expense),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  company: one(company, { fields: [user.companyId], references: [company.id] }),
  branch: one(branch, { fields: [user.branchId], references: [branch.id] }),
  sessions: many(session),
  verifications: many(verificationToken),
  sales: many(sale),
  auditLogs: many(auditLog),
  files: many(companyFile),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const verificationTokenRelations = relations(verificationToken, ({ one }) => ({
  user: one(user, { fields: [verificationToken.userId], references: [user.id] }),
}));

export const productRelations = relations(product, ({ one, many }) => ({
  company: one(company, { fields: [product.companyId], references: [company.id] }),
  saleItems: many(saleItem),
}));

export const customerRelations = relations(customer, ({ one, many }) => ({
  company: one(company, { fields: [customer.companyId], references: [company.id] }),
  sales: many(sale),
}));

export const saleRelations = relations(sale, ({ one, many }) => ({
  company: one(company, { fields: [sale.companyId], references: [company.id] }),
  branch: one(branch, { fields: [sale.branchId], references: [branch.id] }),
  user: one(user, { fields: [sale.userId], references: [user.id] }),
  customer: one(customer, { fields: [sale.customerId], references: [customer.id] }),
  items: many(saleItem),
}));

export const saleItemRelations = relations(saleItem, ({ one }) => ({
  sale: one(sale, { fields: [saleItem.saleId], references: [sale.id] }),
  product: one(product, { fields: [saleItem.productId], references: [product.id] }),
}));

export const expenseRelations = relations(expense, ({ one }) => ({
  company: one(company, { fields: [expense.companyId], references: [company.id] }),
  branch: one(branch, { fields: [expense.branchId], references: [branch.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  company: one(company, { fields: [auditLog.companyId], references: [company.id] }),
  user: one(user, { fields: [auditLog.userId], references: [user.id] }),
}));

export const companyFileRelations = relations(companyFile, ({ one }) => ({
  company: one(company, { fields: [companyFile.companyId], references: [company.id] }),
  uploadedBy: one(user, { fields: [companyFile.uploadedById], references: [user.id] }),
}));

export const appReportRelations = relations(appReport, ({ one }) => ({
  company: one(company, { fields: [appReport.companyId], references: [company.id] }),
  createdBy: one(user, { fields: [appReport.createdById], references: [user.id] }),
}));
