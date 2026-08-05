import { LayoutDashboard, Activity, Users, Settings, Bot, BarChart3, Package, UsersRound, FileText } from "lucide-react";
import type { Role } from "@prisma/client";
import { ALL_ROLES } from "@/lib/rbac";

export interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
  { href: "/advisor", labelKey: "nav.advisor", icon: Bot, roles: ALL_ROLES },
  { href: "/sales", labelKey: "nav.sales", icon: BarChart3, roles: ALL_ROLES },
  { href: "/inventory", labelKey: "nav.inventory", icon: Package, roles: ALL_ROLES },
  { href: "/customers", labelKey: "nav.customers", icon: UsersRound, roles: ALL_ROLES },
  { href: "/reports", labelKey: "nav.reports", icon: FileText, roles: ALL_ROLES },
  { href: "/activity", labelKey: "nav.activity", icon: Activity, roles: ["OWNER", "ADMIN"] },
  { href: "/team", labelKey: "nav.team", icon: Users, roles: ["OWNER", "ADMIN"] },
  { href: "/settings", labelKey: "nav.settings", icon: Settings, roles: ["OWNER", "ADMIN"] },
];

export function isAdmin(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}
