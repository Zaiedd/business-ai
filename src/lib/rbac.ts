import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
  EMPLOYEE: "Employee",
};

// Numeric rank used to compare role hierarchy.
export const ROLE_RANK: Record<Role, number> = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,
  ACCOUNTANT: 2,
  EMPLOYEE: 1,
};

export const ALL_ROLES = Object.keys(ROLE_LABELS) as Role[];

export function isAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

// Roles allowed to administer the workspace (users, settings, branches).
export function isAdminRole(role: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageUsers(actor: Role, target: Role): boolean {
  return isAdminRole(actor) && ROLE_RANK[actor] > ROLE_RANK[target];
}
