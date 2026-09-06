"use client";

import { AlertTriangle, CheckCircle2, Info, XCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Insight } from "@/server/ai/types";
import { useI18n } from "@/components/i18n-provider";

const SEVERITY_STYLES: Record<Insight["severity"], { icon: typeof Info; iconClass: string; ring: string }> = {
  critical: { icon: XCircle, iconClass: "text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/15", ring: "border-rose-100 dark:border-rose-900" },
  warning: { icon: AlertTriangle, iconClass: "text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/15", ring: "border-amber-100 dark:border-amber-900" },
  info: { icon: Info, iconClass: "text-sky-600 bg-sky-50 dark:text-sky-300 dark:bg-sky-500/15", ring: "border-sky-100 dark:border-sky-900" },
  success: { icon: CheckCircle2, iconClass: "text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15", ring: "border-emerald-100 dark:border-emerald-900" },
};

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Sparkles className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("dashboard.insightsTitle")}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t("dashboard.insightsSubtitle")}</p>
        </div>
      </div>
      <ul className="max-h-[520px] space-y-3 overflow-y-auto pe-1">
        {insights.map((insight) => {
          const s = SEVERITY_STYLES[insight.severity];
          return (
            <li key={insight.id} className={cn("rounded-xl border bg-white p-4 dark:bg-slate-900", s.ring)}>
              <div className="flex items-start gap-3">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", s.iconClass)}>
                  <s.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{insight.title}</h4>
                    {insight.metric && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {insight.metric.label}: {insight.metric.value}
                        {insight.metric.delta ? ` (${insight.metric.delta})` : ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{insight.description}</p>
                  {insight.recommendation && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">{t("dashboard.recommendation")}</span>
                      {insight.recommendation}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
