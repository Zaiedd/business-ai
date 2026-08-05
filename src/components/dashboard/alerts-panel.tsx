"use client";

import { AlertTriangle, BellRing, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Insight } from "@/server/ai/types";
import { useI18n } from "@/components/i18n-provider";

export function AlertsPanel({ alerts }: { alerts: Insight[] }) {
  const { t } = useI18n();
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/15">
          <BellRing className="size-6 text-emerald-500" />
        </span>
        <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">{t("dashboard.alertsEmptyTitle")}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("dashboard.alertsEmptySubtitle")}</p>
      </div>
    );
  }

  return (
    <ul id="alerts" className="space-y-2.5">
      {alerts.map((a) => (
        <li
          key={a.id}
          className={cn(
            "flex items-start gap-3 rounded-xl border p-3",
            a.severity === "critical"
              ? "border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/40"
              : "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/40",
          )}
        >
          {a.severity === "critical" ? (
            <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500 dark:text-rose-400" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500 dark:text-amber-400" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{a.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{a.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
