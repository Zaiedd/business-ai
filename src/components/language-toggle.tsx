"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  const isArabic = locale === "ar";
  return (
    <button
      onClick={() => setLocale(isArabic ? "en" : "ar")}
      title={isArabic ? "Switch to English" : "التبديل إلى العربية"}
      aria-label={isArabic ? "Switch to English" : "التبديل إلى العربية"}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
        className,
      )}
    >
      <Languages className="size-4" />
      {isArabic ? "EN" : "ع"}
    </button>
  );
}
