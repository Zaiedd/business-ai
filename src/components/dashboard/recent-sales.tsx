"use client";

import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

export interface RecentSale {
  id: string;
  invoiceNo: string;
  date: Date | string;
  total: number;
  status: string;
  branch: { name: string } | null;
  customer: { name: string } | null;
  user: { name: string } | null;
}

export function RecentSalesTable({ sales, currency }: { sales: RecentSale[]; currency: string }) {
  const { t, locale } = useI18n();
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
            <th className="py-2 pr-3 font-semibold">{t("dashboard.table.invoice")}</th>
            <th className="py-2 pr-3 font-semibold">{t("dashboard.table.date")}</th>
            <th className="py-2 pr-3 font-semibold">{t("dashboard.table.customer")}</th>
            <th className="py-2 pr-3 font-semibold">{t("dashboard.table.branch")}</th>
            <th className="py-2 pr-3 text-end font-semibold">{t("dashboard.table.total")}</th>
            <th className="py-2 text-end font-semibold">{t("dashboard.table.status")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
          {sales.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
              <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">{s.invoiceNo}</td>
              <td className="py-2.5 pr-3 text-slate-500 dark:text-slate-400">{formatDate(s.date, locale)}</td>
              <td className="max-w-[140px] truncate py-2.5 pr-3 text-slate-600 dark:text-slate-400">{s.customer?.name ?? "—"}</td>
              <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-400">{s.branch?.name ?? "—"}</td>
              <td className="py-2.5 pr-3 text-end font-medium text-slate-900 dark:text-slate-100">{formatCurrency(s.total, currency)}</td>
              <td className="py-2.5 text-end">
                <Badge variant={s.status === "COMPLETED" ? "success" : s.status === "PENDING" ? "warning" : "neutral"}>{t(`dashboard.status.${s.status}`)}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
