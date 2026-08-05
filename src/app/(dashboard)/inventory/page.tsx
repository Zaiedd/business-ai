"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  costPrice: number;
  sellingPrice: number;
  stockQty: number;
  lowStockThreshold: number;
  status: "OK" | "LOW" | "OUT";
  margin: number;
}

const emptyForm = { name: "", sku: "", category: "", costPrice: "", sellingPrice: "", stockQty: "", lowStockThreshold: "10" };

export default function InventoryPage() {
  const { t } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("inventory.loadFailed"));
      setProducts(body.data.products);
      setCurrency(body.data.currency ?? "USD");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("inventory.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      category: p.category ?? "",
      costPrice: String(p.costPrice),
      sellingPrice: String(p.sellingPrice),
      stockQty: String(p.stockQty),
      lowStockThreshold: String(p.lowStockThreshold),
    });
    setFormError(null);
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload = {
      name: form.name,
      sku: form.sku || null,
      category: form.category || null,
      costPrice: Number(form.costPrice),
      sellingPrice: Number(form.sellingPrice),
      stockQty: Number(form.stockQty),
      lowStockThreshold: Number(form.lowStockThreshold),
    };
    const res = await fetch(editingId ? `/api/inventory?id=${editingId}` : "/api/inventory", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      setFormError(body.error ?? t("inventory.saveFailed"));
      setSaving(false);
      return;
    }
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setSaving(false);
    load();
  }

  async function del(p: Product) {
    if (!window.confirm(t("common.confirmDelete"))) return;
    const res = await fetch(`/api/inventory?id=${p.id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      alert(body.error ?? t("inventory.deleteFailed"));
      return;
    }
    load();
  }

  function stockBadge(p: Product) {
    if (p.status === "OUT") return <Badge variant="critical">{t("inventory.out")}</Badge>;
    if (p.status === "LOW") return <Badge variant="warning">{t("inventory.low")}</Badge>;
    return <Badge variant="success">{t("inventory.ok")}</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("inventory.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("inventory.subtitle")}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="size-4" />
          {t("inventory.addProduct")}
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
          <CardHeader title={editingId ? t("inventory.editProduct") : t("inventory.formTitle")} subtitle={t("inventory.formSubtitle")} />
          <CardBody>
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input label={t("inventory.name")} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label={t("inventory.sku")} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              <Input label={t("inventory.category")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <Input label={t("inventory.costPrice")} type="number" min={0} step="0.01" required value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
              <Input label={t("inventory.sellingPrice")} type="number" min={0} step="0.01" required value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
              <Input label={t("inventory.stock")} type="number" min={0} step={1} required value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} />
              <Input label={t("inventory.reorderLevel")} type="number" min={0} step={1} required value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
              <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-4">
                {formError && <p className="text-sm text-rose-600 dark:text-rose-400">{formError}</p>}
                <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" loading={saving} className="ms-auto">
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title={t("inventory.title")}
          subtitle={filtered.length === 1 ? t("inventory.title") : t("inventory.title")}
        />
        <CardBody className="-mx-5 overflow-x-auto px-5">
          <div className="relative mb-3 max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder={t("inventory.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} className="ps-9" />
          </div>
          {loading ? (
            <div className="grid gap-3 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{query ? t("common.noResults") : t("inventory.empty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
                  <th className="py-2 pr-4 font-semibold">{t("inventory.product")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("inventory.category")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("inventory.costPrice")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("inventory.sellingPrice")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("inventory.margin")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("inventory.stock")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("inventory.stockStatus")}</th>
                  <th className="py-2 text-end font-semibold">{t("inventory.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{p.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{p.sku}</div>
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{p.category ?? "—"}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{formatCurrency(p.costPrice, currency)}</td>
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">{formatCurrency(p.sellingPrice, currency)}</td>
                    <td className="py-3 pr-4 text-emerald-600 dark:text-emerald-400">{formatCurrency(p.margin, currency)}</td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{formatNumber(p.stockQty)}</td>
                    <td className="py-3 pr-4">{stockBadge(p)}</td>
                    <td className="py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50" title={t("common.edit")}>
                          <Pencil className="size-4" />
                        </button>
                        <button onClick={() => del(p)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50" title={t("common.delete")}>
                          <Trash2 className="size-4" />
                        </button>
                      </div>
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
