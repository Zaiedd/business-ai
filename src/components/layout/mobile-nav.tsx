"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, LogOut, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/components/i18n-provider";
import type { Role } from "@/lib/auth";
import { NAV_ITEMS } from "@/components/layout/nav-items";

interface MobileNavProps {
  userName: string;
  userEmail: string;
  role: Role;
  companyName: string;
}

export function MobileNav({ userName, userEmail, role, companyName }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label={t("a11y.openNav")}>
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute inset-y-0 start-0 flex w-72 max-w-[80vw] flex-col bg-slate-900 shadow-2xl"
            >
              <div className="flex h-14 items-center justify-between border-b border-white/5 px-4">
                <Logo light />
                <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 hover:text-white" aria-label={t("a11y.closeNav")}>
                  <X className="size-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
                {NAV_ITEMS.filter((i) => i.roles.includes(role)).map((item, idx) => {
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.2 }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                          active ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        <item.icon className="size-4.5" />
                        {t(item.labelKey)}
                      </Link>
                    </motion.div>
                  );
                })}
                <div className="mt-6 rounded-xl border border-white/10 bg-gradient-to-br from-indigo-500/15 to-violet-500/15 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <Sparkles className="size-3.5 text-indigo-400" />
                    {t("nav.aiEngine")}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{t("nav.aiTaglineShort", { company: companyName })}</p>
                </div>
              </nav>
              <div className="border-t border-white/5 p-3">
                <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <div className="flex size-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{userName}</div>
                    <div className="truncate text-[11px] text-slate-400">{userEmail}</div>
                  </div>
                  <button onClick={logout} title={t("common.signOut")} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">
                    <LogOut className="size-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
