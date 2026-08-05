import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_PASSWORD = "Password123!";

// Deterministic PRNG so seeding is reproducible.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeDate(daysAgo: number, hour = 12): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, 0, 0);
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const rnd = mulberry32(42);

  // ------------------------------------------------------------------
  // Companies + branches
  // ------------------------------------------------------------------
  const acme = await prisma.company.create({
    data: { id: "c_acme", name: "Acme Trading Co.", slug: "acme", industry: "Retail", currency: "USD", taxRate: 0.08 },
  });
  const northwind = await prisma.company.create({
    data: { id: "c_nw", name: "Northwind Studio", slug: "northwind", industry: "Services", currency: "USD", taxRate: 0 },
  });

  await prisma.branch.createMany({
    data: [
      { id: "b_acme_dt", name: "Downtown HQ", address: "120 Market St", city: "Springfield", companyId: "c_acme" },
      { id: "b_acme_ns", name: "Northside Mall", address: "4501 Mall Rd", city: "Springfield", companyId: "c_acme" },
      { id: "b_nw_one", name: "Studio One", address: "9 Artisan Lane", city: "Portland", companyId: "c_nw" },
    ],
  });

  // ------------------------------------------------------------------
  // Users (RBAC demo accounts)
  // ------------------------------------------------------------------
  const userDefs = [
    { id: "u_acme_owner", email: "owner@acme.test", name: "Alex Morgan", role: "OWNER", companyId: "c_acme", branchId: "b_acme_dt" },
    { id: "u_acme_admin", email: "admin@acme.test", name: "Sam Rivera", role: "ADMIN", companyId: "c_acme", branchId: "b_acme_dt" },
    { id: "u_acme_mgr", email: "manager@acme.test", name: "Jordan Lee", role: "MANAGER", companyId: "c_acme", branchId: "b_acme_dt" },
    { id: "u_acme_acct", email: "accountant@acme.test", name: "Priya Patel", role: "ACCOUNTANT", companyId: "c_acme", branchId: "b_acme_dt" },
    { id: "u_acme_emp1", email: "employee1@acme.test", name: "Taylor Brooks", role: "EMPLOYEE", companyId: "c_acme", branchId: "b_acme_dt" },
    { id: "u_acme_emp2", email: "employee2@acme.test", name: "Morgan Chen", role: "EMPLOYEE", companyId: "c_acme", branchId: "b_acme_ns" },
    { id: "u_nw_owner", email: "owner@northwind.test", name: "Dana Wright", role: "OWNER", companyId: "c_nw", branchId: "b_nw_one" },
  ];

  await prisma.user.createMany({
    data: userDefs.map((u) => ({
      ...u,
      passwordHash,
      emailVerifiedAt: new Date(),
      role: u.role as never,
    })),
  });

  // ------------------------------------------------------------------
  // Products
  // ------------------------------------------------------------------
  const products = [
    { id: "p1", name: "Espresso Roast (1kg)", sku: "CFF-001", category: "Coffee", costPrice: 6.5, sellingPrice: 12.0, stockQty: 340, lowStockThreshold: 40 },
    { id: "p2", name: "Arabica Beans (1kg)", sku: "CFF-002", category: "Coffee", costPrice: 8.0, sellingPrice: 15.5, stockQty: 18, lowStockThreshold: 40 },
    { id: "p3", name: "Ceramic Mug 350ml", sku: "BAR-101", category: "Barware", costPrice: 2.2, sellingPrice: 6.0, stockQty: 210, lowStockThreshold: 50 },
    { id: "p4", name: "Cold Brew Bottle", sku: "BVR-201", category: "Beverages", costPrice: 1.8, sellingPrice: 4.5, stockQty: 420, lowStockThreshold: 80 },
    { id: "p5", name: "Croissant (pack of 4)", sku: "FT-301", category: "Bakery", costPrice: 2.4, sellingPrice: 6.8, stockQty: 96, lowStockThreshold: 30 },
    { id: "p6", name: "Matcha Powder", sku: "CFF-006", category: "Coffee", costPrice: 9.0, sellingPrice: 18.0, stockQty: 12, lowStockThreshold: 20 },
    { id: "p7", name: "Glass Pour-Over Kit", sku: "BAR-110", category: "Barware", costPrice: 7.5, sellingPrice: 19.9, stockQty: 64, lowStockThreshold: 20 },
    { id: "p8", name: "Iced Tea Lemon (1L)", sku: "BVR-208", category: "Beverages", costPrice: 1.4, sellingPrice: 3.9, stockQty: 180, lowStockThreshold: 60 },
    { id: "p9", name: "Sandwich Combo", sku: "FT-310", category: "Bakery", costPrice: 3.1, sellingPrice: 8.5, stockQty: 75, lowStockThreshold: 25 },
    { id: "p10", name: "Chocolate Cake Slice", sku: "FT-314", category: "Desserts", costPrice: 2.0, sellingPrice: 5.5, stockQty: 110, lowStockThreshold: 30 },
    { id: "p11", name: "Thermal Tumbler 500ml", sku: "BAR-120", category: "Barware", costPrice: 6.0, sellingPrice: 14.0, stockQty: 48, lowStockThreshold: 20 },
    { id: "p12", name: "Lemonade (500ml)", sku: "BVR-212", category: "Beverages", costPrice: 0.9, sellingPrice: 2.9, stockQty: 260, lowStockThreshold: 70 },
  ];
  await prisma.product.createMany({ data: products.map((p) => ({ ...p, companyId: "c_acme" })) });

  const nwProducts = [
    { id: "p_nw1", name: "Brand Strategy Session", sku: "SVC-01", category: "Services", costPrice: 20, sellingPrice: 150, stockQty: 999, lowStockThreshold: 1 },
    { id: "p_nw2", name: "Logo Design Package", sku: "SVC-02", category: "Services", costPrice: 30, sellingPrice: 250, stockQty: 999, lowStockThreshold: 1 },
  ];
  await prisma.product.createMany({ data: nwProducts.map((p) => ({ ...p, companyId: "c_nw" })) });

  // ------------------------------------------------------------------
  // Customers
  // ------------------------------------------------------------------
  const customers = [
    { id: "cu1", name: "Maya Thompson", email: "maya@example.com", phone: "555-0101" },
    { id: "cu2", name: "Liam Nguyen", email: "liam@example.com", phone: "555-0102" },
    { id: "cu3", name: "Olivia Garcia", email: "olivia@example.com", phone: "555-0103" },
    { id: "cu4", name: "Noah Kim", email: "noah@example.com", phone: "555-0104" },
    { id: "cu5", name: "Emma Rossi", email: "emma@example.com", phone: "555-0105" },
    { id: "cu6", name: "Ethan Patel", email: "ethan@example.com", phone: "555-0106" },
    { id: "cu7", name: "Ava Johnson", email: "ava@example.com", phone: "555-0107" },
    { id: "cu8", name: "Lucas Silva", email: "lucas@example.com", phone: "555-0108" },
    { id: "cu9", name: "Sofia Brown", email: "sofia@example.com", phone: "555-0109" },
    { id: "cu10", name: "Henry Wilson", email: "henry@example.com", phone: "555-0110" },
  ];
  await prisma.customer.createMany({
    data: customers.map((c) => ({ ...c, companyId: "c_acme", segment: "REGULAR", totalSpent: 0, totalOrders: 0 })),
  });

  // ------------------------------------------------------------------
  // Sales (last 200 days, with trend + random dips)
  // ------------------------------------------------------------------
  const employees = ["u_acme_mgr", "u_acme_emp1", "u_acme_emp2"];
  const branches = ["b_acme_dt", "b_acme_ns"];
  const DAYS = 200;

  let invoiceCounter = 1000;
  const sales: any[] = [];
  const items: any[] = [];
  const customerStats = new Map<string, { orders: number; spent: number; last: Date }>();

  for (let d = DAYS - 1; d >= 0; d--) {
    const date = makeDate(d);
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    // gentle growth over time + weekend bump + noise
    let base = 340 + (DAYS - d) * 1.8;
    if (isWeekend) base *= 1.25;
    const revenueTarget = Math.max(80, base * (0.75 + rnd() * 0.5));
    // occasional bad days (system outage / stock out) -> creates "why sales dip" insight
    const isDip = rnd() < 0.06;
    const dipFactor = isDip ? 0.35 + rnd() * 0.3 : 1;

    let revenue = 0;
    const daySales: any[] = [];
    let guard = 0;
    while (revenue < revenueTarget * dipFactor && guard < 30) {
      guard++;
      const product = products[Math.floor(rnd() * products.length)];
      const qty = 1 + Math.floor(rnd() * 3);
      const unitPrice = product.sellingPrice;
      const lineTotal = qty * unitPrice;
      revenue += lineTotal;

      const employee = employees[Math.floor(rnd() * employees.length)];
      const branch = branches[Math.floor(rnd() * branches.length)];
      const withCustomer = rnd() < 0.72;
      const customerId = withCustomer ? customers[Math.floor(rnd() * customers.length)].id : null;
      const discountPct = rnd() < 0.3 ? 0.05 : 0;
      const subtotal = revenue;
      const discount = subtotal * discountPct;
      const tax = (subtotal - discount) * acme.taxRate;
      const total = subtotal - discount + tax;

      const saleId = `s_${d}_${guard}`;
      const invoiceNo = `INV-${date.getFullYear()}-${String(invoiceCounter++).padStart(4, "0")}`;
      daySales.push(saleId);

      sales.push({
        id: saleId,
        invoiceNo,
        date,
        subtotal,
        discount,
        tax,
        total,
        status: "COMPLETED",
        companyId: "c_acme",
        branchId: branch,
        userId: employee,
        customerId,
      });
      items.push({
        id: `si_${d}_${guard}`,
        saleId,
        productId: product.id,
        qty,
        unitPrice,
        costPrice: product.costPrice,
        total: lineTotal,
      });
      if (customerId) {
        const stat = customerStats.get(customerId) ?? { orders: 0, spent: 0, last: new Date(0) };
        stat.orders += 1;
        stat.spent += total;
        if (date > stat.last) stat.last = date;
        customerStats.set(customerId, stat);
      }
    }
    // revenue was accumulated across lines; correct subtotal for single invoice
    // Recompute cleanly: use last accumulated values
    void daySales;
  }

  // Fix subtotal/tax: sales were computed with cumulative revenue -> recalc per sale
  for (const s of sales) {
    const lineTotal = items.filter((i) => i.saleId === s.id).reduce((a, i) => a + i.total, 0);
    s.subtotal = lineTotal;
    const discount = s.discount > 0 ? lineTotal * 0.05 : 0;
    s.discount = discount;
    s.tax = (lineTotal - discount) * acme.taxRate;
    s.total = lineTotal - discount + s.tax;
  }

  for (let i = 0; i < sales.length; i += 500) {
    await prisma.sale.createMany({ data: sales.slice(i, i + 500) });
    await prisma.saleItem.createMany({ data: items.slice(i, i + 500) });
  }

  // Update customer aggregates to match generated sales
  for (const [id, stat] of customerStats) {
    await prisma.customer.update({
      where: { id },
      data: {
        totalOrders: stat.orders,
        totalSpent: Math.round(stat.spent * 100) / 100,
        lastPurchaseAt: stat.last,
        segment: stat.spent > 1200 ? "VIP" : stat.orders >= 8 ? "REGULAR" : "NEW",
      },
    });
  }

  // Northwind: a few sales so the second company is non-empty
  await prisma.sale.createMany({
    data: [
      { id: "s_nw1", invoiceNo: "NW-0001", date: makeDate(6), subtotal: 150, discount: 0, tax: 0, total: 150, status: "COMPLETED", companyId: "c_nw", branchId: "b_nw_one", userId: "u_nw_owner" },
      { id: "s_nw2", invoiceNo: "NW-0002", date: makeDate(3), subtotal: 250, discount: 0, tax: 0, total: 250, status: "COMPLETED", companyId: "c_nw", branchId: "b_nw_one", userId: "u_nw_owner" },
    ],
  });
  await prisma.saleItem.createMany({
    data: [
      { id: "si_nw1", saleId: "s_nw1", productId: "p_nw1", qty: 1, unitPrice: 150, costPrice: 20, total: 150 },
      { id: "si_nw2", saleId: "s_nw2", productId: "p_nw2", qty: 1, unitPrice: 250, costPrice: 30, total: 250 },
    ],
  });

  // ------------------------------------------------------------------
  // Expenses (recurring pattern over last 180 days)
  // ------------------------------------------------------------------
  const expenses: any[] = [];
  let expId = 0;
  for (let d = 179; d >= 0; d--) {
    const date = makeDate(d);
    const dayOfMonth = date.getDate();
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    if (dayOfMonth === 1) {
      expenses.push({ id: `e_${expId++}`, category: "Rent", description: "Monthly rent", amount: 5000, date, companyId: "c_acme", branchId: "b_acme_dt" });
    }
    if (dayOfMonth === lastDay) {
      expenses.push({ id: `e_${expId++}`, category: "Salaries", description: "Payroll", amount: 16400, date, companyId: "c_acme" });
    }
    if (dayOfMonth === 15) {
      expenses.push({ id: `e_${expId++}`, category: "Utilities", description: "Electricity & water", amount: Math.round(320 + rnd() * 260), date, companyId: "c_acme", branchId: "b_acme_dt" });
    }
    if (d % 7 === 3) {
      expenses.push({ id: `e_${expId++}`, category: "Marketing", description: "Ads & promotions", amount: Math.round(120 + rnd() * 480), date, companyId: "c_acme" });
    }
    if (d % 5 === 1) {
      expenses.push({ id: `e_${expId++}`, category: "Supplies", description: "Packaging & consumables", amount: Math.round(60 + rnd() * 240), date, companyId: "c_acme", branchId: "b_acme_ns" });
    }
    if (rnd() < 0.04) {
      expenses.push({ id: `e_${expId++}`, category: "Maintenance", description: "Equipment repair", amount: Math.round(80 + rnd() * 420), date, companyId: "c_acme" });
    }
  }
  for (let i = 0; i < expenses.length; i += 500) {
    await prisma.expense.createMany({ data: expenses.slice(i, i + 500) });
  }

  // ------------------------------------------------------------------
  // Audit log
  // ------------------------------------------------------------------
  await prisma.auditLog.createMany({
    data: [
      { id: "a1", action: "AUTH.LOGIN", companyId: "c_acme", userId: "u_acme_owner", entity: "User", entityId: "u_acme_owner", metadata: JSON.stringify({ via: "seed" }) },
      { id: "a2", action: "DATA.SEEDED", companyId: "c_acme", entity: "Company", entityId: "c_acme", metadata: JSON.stringify({ sales: sales.length, expenses: expenses.length }) },
    ],
  });

  console.log("Seeding complete.");
  console.log("Demo logins (password: Password123!):");
  for (const u of userDefs) console.log(`  ${u.email.padEnd(24)} ${u.role}`);
  console.log(`  ${fmtDate(makeDate(0))} (today) used as seed reference`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
