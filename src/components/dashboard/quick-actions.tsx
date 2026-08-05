"use client";

import { FileDown, Receipt, Package, UsersRound, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { DateRange } from "@/lib/validators";
import { useI18n } from "@/components/i18n-provider";

export function QuickActions({ range, isAdmin }: { range: DateRange; isAdmin: boolean }) {
  const { t } = useI18n();
  const exportCsv = (type: string) => {
    window.location.href = `/api/reports/csv?type=${type}&range=${range}`;
  };

  const items = [
    { label: t("dashboard.exportSales"), icon: Receipt, onClick: () => exportCsv("sales") },
    { label: t("dashboard.exportExpenses"), icon: Package, onClick: () => exportCsv("expenses") },
    { label: t("dashboard.exportProducts"), icon: Package, onClick: () => exportCsv("products") },
    { label: t("dashboard.exportCustomers"), icon: UsersRound, onClick: () => exportCsv("customers") },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.onClick}
          className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-start text-xs font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40"
        >
          <item.icon className="size-4 text-indigo-500 dark:text-indigo-400" />
          {item.label}
          <FileDown className="ms-auto size-3.5 text-slate-400 dark:text-slate-500" />
        </button>
      ))}
      {isAdmin && (
        <Link
          href="/team"
          className="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          {t("dashboard.manageTeam")} <ArrowRight className="size-3.5 rtl:rotate-180" />
        </Link>
      )}
    </div>
  );
}
