"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";

interface Company {
  id: string;
  name: string;
  slug: string;
  currency: string;
  taxRate: number;
  industry: string | null;
}

interface Branch { id: string; name: string; address: string | null; city: string | null }

export default function SettingsPage() {
  const { t } = useI18n();
  const [company, setCompany] = useState<Company | null>(null);
  const [stats, setStats] = useState<{ users: number; branches: number; products: number; customers: number } | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", currency: "USD", taxRate: "0", industry: "" });

  const [newBranch, setNewBranch] = useState({ name: "", address: "", city: "" });
  const [branchError, setBranchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, bRes] = await Promise.all([
        fetch("/api/settings/company", { cache: "no-store" }),
        fetch("/api/settings/branches", { cache: "no-store" }),
      ]);
      const cBody = await cRes.json();
      const bBody = await bRes.json();
      if (!cRes.ok) throw new Error(cBody.error ?? t("settings.loadFailed"));
      const companyData = cBody.data.company;
      setCompany(companyData);
      setStats(cBody.data.stats);
      setForm({
        name: companyData.name,
        currency: companyData.currency,
        taxRate: String(companyData.taxRate * 100),
        industry: companyData.industry ?? "",
      });
      setBranches(bBody.data?.branches ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    const res = await fetch("/api/settings/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        currency: form.currency,
        taxRate: Number(form.taxRate) / 100,
        industry: form.industry || null,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? t("settings.saveFailed"));
      return;
    }
    setSaved(true);
    load();
    setTimeout(() => setSaved(false), 2500);
  }

  async function addBranch(e: React.FormEvent) {
    e.preventDefault();
    setBranchError(null);
    const res = await fetch("/api/settings/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newBranch.name, address: newBranch.address || null, city: newBranch.city || null }),
    });
    const body = await res.json();
    if (!res.ok) {
      setBranchError(body.error ?? t("settings.addFailed"));
      return;
    }
    setNewBranch({ name: "", address: "", city: "" });
    load();
  }

  async function deleteBranch(id: string) {
    const res = await fetch(`/api/settings/branches?id=${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      alert(body.error ?? t("settings.deleteFailed"));
      return;
    }
    load();
  }

  if (loading && !company) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("settings.title")}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("settings.subtitle")}</p>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
          <CardBody className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle className="size-4" />
            {error}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title={t("settings.companyTitle")} subtitle={t("settings.companySubtitle")} />
        <CardBody>
          <form onSubmit={saveCompany} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={t("settings.companyName")} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label={t("settings.industry")} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder={t("settings.industryPlaceholder")} />
              <Input label={t("settings.currency")} required maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} hint={t("settings.currencyHint")} />
              <Input label={t("settings.taxRate")} type="number" min={0} max={50} step={0.1} value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="flex items-center gap-1 text-sm text-emerald-600">
                  <CheckCircle2 className="size-4" /> {t("settings.saved")}
                </span>
              )}
              <Button type="submit" className="ms-auto">
                {t("settings.saveChanges")}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("settings.users"), value: stats?.users ?? 0 },
          { label: t("settings.branches"), value: stats?.branches ?? 0 },
          { label: t("settings.products"), value: stats?.products ?? 0 },
          { label: t("settings.customers"), value: stats?.customers ?? 0 },
        ].map((s) => (
          <Card key={s.label}>
            <CardBody className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(s.value)}</p>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{s.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title={t("settings.branchesTitle")} subtitle={t("settings.branchesSubtitle")} />
        <CardBody className="space-y-3">
          <form onSubmit={addBranch} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input placeholder={t("settings.branchName")} required value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} />
            <Input placeholder={t("settings.addressOptional")} value={newBranch.address} onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })} />
            <Input placeholder={t("settings.cityOptional")} value={newBranch.city} onChange={(e) => setNewBranch({ ...newBranch, city: e.target.value })} />
            <Button type="submit" variant="secondary">
              <Plus className="size-4" /> {t("settings.addBranch")}
            </Button>
          </form>
          {branchError && <p className="text-sm text-rose-600 dark:text-rose-400">{branchError}</p>}
          <ul className="divide-y divide-slate-50 dark:divide-slate-800">
            {branches.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{b.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{[b.city, b.address].filter(Boolean).join(" · ") || t("settings.noAddress")}</p>
                </div>
                <button onClick={() => deleteBranch(b.id)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-950/50 dark:hover:text-rose-400" title={t("settings.deleteBranch")}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
