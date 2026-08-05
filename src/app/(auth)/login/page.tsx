"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";

const DEMO_ACCOUNTS = [
  { labelKey: "roles.OWNER", email: "owner@acme.test" },
  { labelKey: "roles.ADMIN", email: "admin@acme.test" },
  { labelKey: "roles.MANAGER", email: "manager@acme.test" },
  { labelKey: "roles.ACCOUNTANT", email: "accountant@acme.test" },
  { labelKey: "roles.EMPLOYEE", email: "employee1@acme.test" },
];

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? t("auth.login.failed"));
        setLoading(false);
        return;
      }
      window.location.href = next.startsWith("/") && !next.startsWith("/api") ? next : "/dashboard";
    } catch {
      setError(t("common.networkError"));
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t("auth.login.title")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("auth.login.subtitle")}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Input label={t("auth.login.email")} name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("auth.login.password")}
            </label>
            <Link href="/forgot-password" className="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
              {t("auth.login.forgot")}
            </Link>
          </div>
          <Input name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <Button type="submit" fullWidth loading={loading}>
          {t("auth.login.signIn")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        {t("auth.login.newHere")}{" "}
        <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
          {t("auth.login.createAccount")}
        </Link>
      </p>

      <Card className="mt-6 border-slate-200 dark:border-slate-700">
        <CardBody className="space-y-2 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t("auth.login.demoHint")}</p>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword("Password123!");
                  setError(null);
                }}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950"
              >
                {t(a.labelKey)}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
