"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

export function HealthGauge({ score, label, subtitles }: { score: number; label?: string; subtitles?: string[] }) {
  const { t } = useI18n();
  const bucket = score >= 80 ? ">=80" : score >= 65 ? ">=65" : score >= 50 ? ">=50" : "else";
  const bucketLabels: Record<string, string> = {
    ">=80": t("dashboard.health.excellent"),
    ">=65": t("dashboard.health.good"),
    ">=50": t("dashboard.health.fair"),
    else: t("dashboard.health.atRisk"),
  };
  const strokeColors: Record<string, string> = {
    ">=80": "#10b981",
    ">=65": "#22c55e",
    ">=50": "#f59e0b",
    else: "#f43f5e",
  };
  const textClasses: Record<string, string> = {
    ">=80": "text-emerald-600 dark:text-emerald-300",
    ">=65": "text-emerald-600 dark:text-emerald-300",
    ">=50": "text-amber-600 dark:text-amber-300",
    else: "text-rose-600 dark:text-rose-300",
  };
  const bgClasses: Record<string, string> = {
    ">=80": "bg-emerald-50 dark:bg-emerald-500/15",
    ">=65": "bg-emerald-50 dark:bg-emerald-500/15",
    ">=50": "bg-amber-50 dark:bg-amber-500/15",
    else: "bg-rose-50 dark:bg-rose-500/15",
  };
  const c = {
    stroke: strokeColors[bucket],
    text: textClasses[bucket],
    bg: bgClasses[bucket],
    label: bucketLabels[bucket],
  };
  const R = 52;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, score)) / 100;

  return (
    <div className="flex flex-col items-center py-2">
      <div className="relative size-36">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--chart-grid)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={c.stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{score}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">/ 100</span>
        </div>
      </div>
      <span className={cn("mt-2 rounded-full px-3 py-1 text-xs font-semibold", c.bg, c.text)}>{label ?? c.label}</span>
      {subtitles?.map((s) => (
        <span key={s} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {s}
        </span>
      ))}
    </div>
  );
}
