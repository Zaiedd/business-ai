"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

function VerifyInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const { t } = useI18n();

  async function verify() {
    if (!token) {
      setStatus("error");
      setMessage(t("auth.verify.invalidLink"));
      return;
    }
    setStatus("loading");
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = await res.json();
    setStatus(res.ok ? "ok" : "error");
    setMessage(body.error ?? t("auth.verify.verified"));
  }

  return (
    <div className="py-6 text-center">
      {status === "idle" && (
        <>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t("auth.verify.title")}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("auth.verify.subtitle")}</p>
          <Button className="mt-6" onClick={verify}>
            {t("auth.verify.submit")}
          </Button>
        </>
      )}
      {status === "ok" && (
        <>
          <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
          <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{t("auth.verify.verified")}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{message}</p>
          <Button className="mt-6" onClick={() => (window.location.href = "/login")}>
            {t("auth.verify.continue")}
          </Button>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="mx-auto size-10 text-rose-500" />
          <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{t("auth.verify.failed")}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{message}</p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-indigo-600 dark:text-indigo-400">
            {t("auth.verify.back")}
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
