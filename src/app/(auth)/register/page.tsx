"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? t("auth.register.failed"));
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 700);
    } catch {
      setError(t("common.networkError"));
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
        <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{t("auth.register.created")}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("auth.register.createdSubtitle")}</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t("auth.register.title")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("auth.register.subtitle")}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Input label={t("auth.register.fullName")} name="name" autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
        <Input label={t("auth.register.workEmail")} name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        <Input label={t("auth.register.password")} name="password" type="password" autoComplete="new-password" required minLength={8} hint={t("auth.register.passwordHint")} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        <Button type="submit" fullWidth loading={loading}>
          {t("auth.register.submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {t("auth.register.hasAccount")}{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          {t("auth.register.signIn")}
        </Link>
      </p>
    </>
  );
}
