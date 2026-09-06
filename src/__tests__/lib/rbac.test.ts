import { describe, expect, it } from "vitest";
import { ROLE_RANK, canManageUsers, isAdminRole, isAtLeast } from "@/lib/rbac";

describe("Role-Based Access Control (RBAC)", () => {
  it("ROLE_RANK maintains correct hierarchy order", () => {
    expect(ROLE_RANK.OWNER).toBeGreaterThan(ROLE_RANK.ADMIN);
    expect(ROLE_RANK.ADMIN).toBeGreaterThan(ROLE_RANK.MANAGER);
    expect(ROLE_RANK.MANAGER).toBeGreaterThan(ROLE_RANK.ACCOUNTANT);
    expect(ROLE_RANK.ACCOUNTANT).toBeGreaterThan(ROLE_RANK.EMPLOYEE);
  });

  it("isAtLeast verifies role permissions correctly", () => {
    expect(isAtLeast("OWNER", "ADMIN")).toBe(true);
    expect(isAtLeast("ADMIN", "ADMIN")).toBe(true);
    expect(isAtLeast("MANAGER", "ADMIN")).toBe(false);
    expect(isAtLeast("EMPLOYEE", "ACCOUNTANT")).toBe(false);
  });

  it("isAdminRole identifies administrative roles", () => {
    expect(isAdminRole("OWNER")).toBe(true);
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("MANAGER")).toBe(false);
    expect(isAdminRole("ACCOUNTANT")).toBe(false);
    expect(isAdminRole("EMPLOYEE")).toBe(false);
  });

  it("canManageUsers checks target user role hierarchy", () => {
    // OWNER can manage ADMIN, MANAGER, ACCOUNTANT, EMPLOYEE
    expect(canManageUsers("OWNER", "ADMIN")).toBe(true);
    expect(canManageUsers("OWNER", "EMPLOYEE")).toBe(true);

    // ADMIN can manage MANAGER, but NOT OWNER or another ADMIN
    expect(canManageUsers("ADMIN", "MANAGER")).toBe(true);
    expect(canManageUsers("ADMIN", "OWNER")).toBe(false);
    expect(canManageUsers("ADMIN", "ADMIN")).toBe(false);

    // MANAGER cannot manage users
    expect(canManageUsers("MANAGER", "EMPLOYEE")).toBe(false);
  });
});
