"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  segment: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  totalOrders: number;
  lastPurchaseAt: string | null;
}

const emptyForm = { name: "", email: "", phone: "", segment: "" };
const SEGMENTS = ["VIP", "REGULAR", "NEW"];

export default function CustomersPage() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState<Customer[]>([]);
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
      const res = await fetch("/api/customers", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("customers.loadFailed"));
      setCustomers(body.data.customers);
      setCurrency(body.data.currency ?? "USD");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("customers.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q),
    );
  }, [customers, query]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(c: Customer) {
    setEditingId(c.id);
    setForm({ name: c.name, email: c.email ?? "", phone: c.phone ?? "", segment: c.segment ?? "" });
    setFormError(null);
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const payload = { name: form.name, email: form.email || null, phone: form.phone || null, segment: form.segment || null };
    const res = await fetch(editingId ? `/api/customers?id=${editingId}` : "/api/customers", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      setFormError(body.error ?? t("customers.saveFailed"));
      setSaving(false);
      return;
    }
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setSaving(false);
    load();
  }

  async function del(c: Customer) {
    if (!window.confirm(t("common.confirmDelete"))) return;
    const res = await fetch(`/api/customers?id=${c.id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      alert(body.error ?? t("customers.deleteFailed"));
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("customers.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("customers.subtitle")}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="size-4" />
          {t("customers.addCustomer")}
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
          <CardHeader title={editingId ? t("customers.editCustomer") : t("customers.formTitle")} subtitle={t("customers.formSubtitle")} />
          <CardBody>
            <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input label={t("customers.name")} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label={t("customers.email")} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label={t("customers.phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Select
                label={t("customers.segment")}
                options={[{ value: "", label: "—" }, ...SEGMENTS.map((s) => ({ value: s, label: t(`customers.segments.${s}` as never) }))]}
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value })}
              />
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
        <CardHeader title={t("customers.title")} />
        <CardBody className="-mx-5 overflow-x-auto px-5">
          <div className="relative mb-3 max-w-sm">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder={t("customers.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} className="ps-9" />
          </div>
          {loading ? (
            <div className="grid gap-3 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{query ? t("common.noResults") : t("customers.empty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
                  <th className="py-2 pr-4 font-semibold">{t("customers.name")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("customers.segment")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("customers.totalOrders")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("customers.totalSpent")}</th>
                  <th className="py-2 pr-4 font-semibold">{t("customers.lastPurchase")}</th>
                  <th className="py-2 text-end font-semibold">{t("customers.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{c.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{c.email ?? c.phone ?? "—"}</div>
                    </td>
                    <td className="py-3 pr-4">
                      {c.segment ? (
                        <Badge variant={c.segment === "VIP" ? "brand" : c.segment === "NEW" ? "info" : "neutral"}>
                          {t(`customers.segments.${c.segment}` as never)}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{formatNumber(c.totalOrders)}</td>
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">{formatCurrency(c.totalSpent, currency)}</td>
                    <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{c.lastPurchaseAt ? formatDate(c.lastPurchaseAt) : t("customers.never")}</td>
                    <td className="py-3 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50" title={t("common.edit")}>
                          <Pencil className="size-4" />
                        </button>
                        <button onClick={() => del(c)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50" title={t("common.delete")}>
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
