"use client";

import { Logo } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/components/i18n-provider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(37,99,235,0.35), transparent 40%), radial-gradient(circle at 80% 80%, rgba(30,64,175,0.3), transparent 40%)",
        }}
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Logo light className="scale-125" />
          <LanguageToggle className="text-slate-400 hover:bg-white/10 hover:text-white" />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-blue-950/40 dark:bg-slate-900">{children}</div>
        <p className="mt-6 text-center text-xs text-slate-400">
          {t("auth.layoutFooter")} <span className="font-semibold text-slate-300">By Zaiedd</span>
        </p>
      </div>
    </div>
  );
}
