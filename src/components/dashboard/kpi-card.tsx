"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number; // fractional change vs previous period
  positiveIsGood?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  footer?: string;
  accent?: "indigo" | "emerald" | "rose" | "amber" | "violet";
}

const accents = {
  indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
};

export function KpiCard({ label, value, delta, positiveIsGood = true, icon: Icon, footer, accent = "indigo" }: KpiCardProps) {
  const { t } = useI18n();
  const hasDelta = delta !== undefined && Number.isFinite(delta);
  const up = (delta ?? 0) >= 0;
  const good = positiveIsGood ? up : !up;
  const deltaText = hasDelta ? `${up ? "+" : ""}${(delta! * 100).toFixed(1)}%` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      <Card hover className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
          </div>
          {Icon && (
            <motion.div
              whileHover={{ rotate: 10 }}
              transition={{ type: "spring", stiffness: 400 }}
              className={cn("flex size-10 items-center justify-center rounded-lg", accents[accent])}
            >
              <Icon className="size-5" />
            </motion.div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {hasDelta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
                good
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
              )}
            >
              {deltaText && (up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />)}
              {deltaText}
            </span>
          )}
          {hasDelta && !footer && <span className="text-xs text-slate-400 dark:text-slate-500">{t("dashboard.kpis.vsPrevious")}</span>}
          {footer && <span className="text-xs text-slate-400 dark:text-slate-500">{footer}</span>}
        </div>
      </Card>
    </motion.div>
  );
}

export function DeltaChip({ value, good }: { value: string; good: boolean }) {
  const up = !value.startsWith("-");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
        good
          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
      )}
    >
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {value}
    </span>
  );
}

export { Minus };
