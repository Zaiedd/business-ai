"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/i18n-provider";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t("auth.reset.mismatch"));
      return;
    }
    if (!token) {
      setError(t("auth.reset.invalidLink"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? t("auth.reset.failed"));
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError(t("common.networkError"));
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="py-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
        <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{t("auth.reset.updated")}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("auth.reset.updatedSubtitle")}</p>
        <Button className="mt-6" onClick={() => (window.location.href = "/login")}>
          {t("auth.reset.goToSignIn")}
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t("auth.reset.title")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("auth.reset.subtitle")}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Input label={t("auth.reset.newPassword")} name="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        <Input label={t("auth.reset.confirmPassword")} name="confirm" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
        <Button type="submit" fullWidth loading={loading}>
          {t("auth.reset.submit")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          {t("auth.reset.back")}
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
