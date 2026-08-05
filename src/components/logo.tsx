"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l5-6 4 3 5-7" />
          <path d="M18 3l-1 2" opacity="0" />
          <path d="M3 21h18" />
          <circle cx="17.5" cy="4.5" r="2" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className={cn("text-[15px] font-bold tracking-tight", light ? "text-white" : "text-slate-900 dark:text-slate-100")}>
          {t("brand.name")} <span className="text-indigo-500">{t("brand.ai")}</span>
        </div>
        <div className={cn("text-[10px] font-medium uppercase tracking-widest", light ? "text-slate-400" : "text-slate-400")}>
          {t("brand.tagline")}
        </div>
      </div>
    </div>
  );
}
