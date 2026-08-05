"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/components/i18n-provider";
import type { Role } from "@prisma/client";
import { NAV_ITEMS } from "@/components/layout/nav-items";

interface SidebarProps {
  userName: string;
  userEmail: string;
  role: Role;
  companyName: string;
}

export function Sidebar({ userName, userEmail, role, companyName }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-slate-900 lg:flex">
      <div className="flex h-16 items-center justify-between border-b border-white/5 px-5">
        <Logo light />
        <LanguageToggle className="text-slate-400 hover:bg-white/10 hover:text-white" />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{t("nav.workspace")}</div>
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <item.icon className="size-4.5" />
              {t(item.labelKey)}
            </Link>
          );
        })}

        <div className="mt-6 rounded-xl border border-white/10 bg-gradient-to-br from-indigo-500/15 to-violet-500/15 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Sparkles className="size-3.5 text-indigo-400" />
            {t("nav.aiEngine")}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{t("nav.aiTagline", { company: companyName })}</p>
        </div>
      </nav>

      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{userName}</div>
            <div className="truncate text-[11px] text-slate-400">{userEmail}</div>
          </div>
          <button
            onClick={logout}
            title={t("common.signOut")}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
