"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? t("auth.forgot.failed"));
        setLoading(false);
        return;
      }
      setMessage(t("auth.forgot.generic"));
      if (body.data?.devResetLink) {
        setMessage(t("auth.forgot.devLink", { link: body.data.devResetLink }));
      }
      setLoading(false);
    } catch {
      setError(t("common.networkError"));
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t("auth.forgot.title")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("auth.forgot.subtitle")}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {message && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span className="break-all">{message}</span>
          </div>
        )}
        <Input label={t("auth.forgot.email")} name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        <Button type="submit" fullWidth loading={loading}>
          {t("auth.forgot.submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {t("auth.forgot.remembered")}{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          {t("auth.forgot.back")}
        </Link>
      </p>
    </>
  );
}
