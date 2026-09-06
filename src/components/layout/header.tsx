"use client";

import Link from "next/link";
import { Building2, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/components/i18n-provider";
import type { Role } from "@/lib/auth";

interface HeaderProps {
  companyName: string;
  branchName: string | null;
  role: Role;
}

export function Header({ companyName, branchName, role }: HeaderProps) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-20 hidden h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-6 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 lg:flex">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-800">
          <Building2 className="size-4.5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{companyName}</span>
            <Badge variant="brand">{t(`roles.${role}`)}</Badge>
          </div>
          <div className="truncate text-xs text-slate-500 dark:text-slate-400">{branchName ?? t("common.allBranches")}</div>
        </div>
      </div>

      <div className="ms-auto flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
        <Link
          href="/dashboard#alerts"
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          title={t("dashboard.charts.alertsTitle")}
        >
          <Bell className="size-5" />
        </Link>
      </div>
    </header>
  );
}
