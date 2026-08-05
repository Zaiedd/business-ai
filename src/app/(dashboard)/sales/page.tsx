"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { formatCurrency, formatDate, round2, safeParseFloat, toDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";

interface SaleItem {
  id: string;
  productId: string;
  qty: number;
  unitPrice: number;
  total: number;
  product: { name: string };
}

interface Sale {
  id: string;
  invoiceNo: string;
  date: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: "COMPLETED" | "PENDING" | "REFUNDED";
  branch: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  user: { id: string; name: string } | null;
  items: SaleItem[];
}

interface RefItem {
  id: string;
  name: string;
  sellingPrice: number;
  stockQty: number;
}

interface RefCustomer {
  id: string;
  name: string;
}

interface RefBranch {
  id: string;
  name: string;
}

interface FormRow {
  productId: string;
  qty: string;
  unitPrice: string;
}

const STATUSES = ["COMPLETED", "PENDING", "REFUNDED"] as const;

export default function SalesPage() {
  const { t } = useI18n();
  const [sales, setSales] = useState<Sale[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState(0);
  const [branches, setBranches] = useState<RefBranch[]>([]);
  const [customers, setCustomers] = useState<RefCustomer[]>([]);
  const [products, setProducts] = useState<RefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(toDateKey(new Date()));
  const [discount, setDiscount] = useState("0");
  const [rows, setRows] = useState<FormRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sales", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("sales.loadFailed"));
      setSales(body.data.sales);
      setCurrency(body.data.currency ?? "USD");
      setTaxRate(body.data.taxRate ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("sales.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadRefs = useCallback(async () => {
    try {
      const res = await fetch("/api/sales/refs", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) return;
      setBranches(body.data.branches ?? []);
      setCustomers(body.data.customers ?? []);
      setProducts(body.data.products ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
    loadRefs();
  }, [load, loadRefs]);

  const subtotal = useMemo(() => round2(rows.reduce((sum, r) => sum + safeParseFloat(r.qty) * safeParseFloat(r.unitPrice), 0)), [rows]);
  const discountNum = useMemo(() => safeParseFloat(discount), [discount]);
  const taxable = round2(Math.max(0, subtotal - discountNum));
  const tax = round2(taxRate * taxable);
  const total = round2(taxable + tax);

  function openAdd() {
    setBranchId("");
    setCustomerId("");
    setDate(toDateKey(new Date()));
    setDiscount("0");
    setRows([{ productId: "", qty: "1", unitPrice: "" }]);
    setFormError(null);
    setShowForm(true);
  }

  function setRow(index: number, patch: Partial<FormRow>) {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === index ? { ...r, ...patch } : r));
      return next;
    });
  }

  function onProductSelect(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    setRow(index, { productId, unitPrice: product ? String(product.sellingPrice) : "" });
  }

  async function createSale(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const items = rows
      .filter((r) => r.productId)
      .map((r) => ({ productId: r.productId, qty: Math.round(safeParseFloat(r.qty)), unitPrice: safeParseFloat(r.unitPrice) }));
    if (items.length === 0) {
      setFormError(t("api.noProducts"));
      setSaving(false);
      return;
    }
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId: branchId || null,
        customerId: customerId || null,
        date,
        discount: discountNum,
        items,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setFormError(body.error ?? t("sales.createFailed"));
      setSaving(false);
      return;
    }
    setShowForm(false);
    setRows([]);
    setSaving(false);
    load();
    loadRefs();
  }

  async function changeStatus(sale: Sale, status: string) {
    if (sale.status === status) return;
    setUpdatingId(sale.id);
    const res = await fetch(`/api/sales?id=${sale.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const body = await res.json();
    if (!res.ok) {
      alert(body.error ?? t("sales.updateFailed"));
      setUpdatingId(null);
      return;
    }
    setUpdatingId(null);
    load();
    loadRefs();
  }

  async function del(sale: Sale) {
    if (!window.confirm(t("common.confirmDelete"))) return;
    const res = await fetch(`/api/sales?id=${sale.id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      alert(body.error ?? t("sales.deleteFailed"));
      return;
    }
    load();
    loadRefs();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("sales.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("sales.subtitle")}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="size-4" />
          {t("sales.newSale")}
        </Button>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
          <CardBody className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle className="size-4" />
            {error}
            <Button variant="danger" size="sm" className="ms-auto" onClick={load}>{t("common.retry")}</Button>
          </CardBody>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader title={t("sales.formTitle")} subtitle={t("sales.formSubtitle")} />
          <CardBody>
            <form onSubmit={createSale} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Select
                  label={t("sales.branch")}
                  options={[{ value: "", label: t("sales.selectBranch") }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                />
                <Select
                  label={t("sales.customer")}
                  options={[{ value: "", label: t("sales.selectCustomer") }, ...customers.map((c) => ({ value: c.id, label: c.name }))]}
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                />
                <Input label={t("sales.date")} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t("sales.invoiceNo")}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, { productId: "", qty: "1", unitPrice: "" }])}>
                    <Plus className="size-3.5" />
                    {t("sales.addItem")}
                  </Button>
                </div>
                {products.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
                    {t("sales.noProducts")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {rows.map((row, index) => (
                      <div key={index} className="grid grid-cols-[1fr_5rem_8rem_8rem_2rem] items-center gap-2">
                        <Select
                          options={products.map((p) => ({ value: p.id, label: `${p.name} · ${t("sales.stock", { stock: String(p.stockQty) })}` }))}
                          value={row.productId}
                          onChange={(e) => onProductSelect(index, e.target.value)}
                        />
                        <Input type="number" min={1} step={1} required value={row.qty} onChange={(e) => setRow(index, { qty: e.target.value })} />
                        <Input type="number" min={0} step="0.01" required value={row.unitPrice} onChange={(e) => setRow(index, { unitPrice: e.target.value })} />
                        <div className="flex items-center justify-end text-sm font-medium text-slate-700 dark:text-slate-300">
                          {formatCurrency(round2(safeParseFloat(row.qty) * safeParseFloat(row.unitPrice)), currency)}
                        </div>
                        <button
                          type="button"
                          onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                          title={t("common.delete")}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <Input label={t("sales.discount")} type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                <div className="flex items-end justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 sm:col-span-3">
                  <div className="space-y-1">
                    <p className="flex justify-between gap-8 text-slate-500 dark:text-slate-400">
                      <span>{t("sales.subtotal")}</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(subtotal, currency)}</span>
                    </p>
                    <p className="flex justify-between gap-8 text-slate-500 dark:text-slate-400">
                      <span>{t("sales.tax")} ({(taxRate * 100).toFixed(0)}%)</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(tax, currency)}</span>
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-xs uppercase tracking-wide text-slate-400">{t("sales.total")}</p>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(total, currency)}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>{t("common.cancel")}</Button>
                <Button type="submit" loading={saving} className="ms-auto">
                  {t("sales.created")}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title={t("sales.title")}
          subtitle={sales.length === 1 ? t("sales.salesCount", { count: String(sales.length) }) : t("sales.salesCount", { count: String(sales.length) })}
        />
        <CardBody className="-mx-5 overflow-x-auto px-5">
          {loading ? (
            <div className="grid gap-3 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : sales.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{t("sales.empty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
                  <th className="py-2 pr-4 font-semibold">{t("sales.invoice")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("sales.date")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("sales.customer")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("sales.branch")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("sales.employee")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("sales.items")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("sales.total")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("sales.status")}</th>
                  <th className="py-2 text-end font-semibold">{t("sales.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">{s.invoiceNo}</td>
                    <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{formatDate(s.date)}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{s.customer?.name ?? "—"}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{s.branch?.name ?? "—"}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{s.user?.name ?? "—"}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{t("sales.itemsCount", { count: String(s.items.length) })}</td>
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">{formatCurrency(s.total, currency)}</td>
                    <td className="py-3 pr-4">
                      <select
                        value={s.status}
                        disabled={updatingId === s.id}
                        onChange={(e) => changeStatus(s, e.target.value)}
                        className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        {STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {t(`dashboard.status.${st}`)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 text-end">
                      <button onClick={() => del(s)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50" title={t("sales.deleteTitle")}>
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
