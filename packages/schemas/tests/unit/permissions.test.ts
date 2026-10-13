import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  SUPER_ADMIN_ROLE,
  SYSTEM_ROLES,
  hasPermission,
  permissionSchema,
} from "@showbuzz/schemas/permissions";
import { newPasswordSchema } from "@showbuzz/schemas/staff";

const role = (name: string) => {
  const found = SYSTEM_ROLES.find((r) => r.name === name);
  if (!found) throw new Error(`missing role ${name}`);
  return found.permissions;
};

describe("hasPermission", () => {
  it("grants only what the role lists", () => {
    expect(hasPermission(["movies:read"], "movies:read")).toBe(true);
    expect(hasPermission(["movies:read"], "movies:write")).toBe(false);
  });

  it("never treats write as implying another action", () => {
    expect(hasPermission(["refunds:read", "refunds:write"], "refunds:approve")).toBe(false);
  });
});

describe("permission catalogue", () => {
  it("has read and write for every menu resource, without duplicates", () => {
    expect(PERMISSIONS).toContain("movies:read");
    expect(PERMISSIONS).toContain("backup:write");
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it("rejects permissions that don't exist", () => {
    expect(permissionSchema.safeParse("movies:read").success).toBe(true);
    expect(permissionSchema.safeParse("movies:delete-everything").success).toBe(false);
  });
});

describe("system roles", () => {
  it("are the five roles of the prototype matrix", () => {
    expect(SYSTEM_ROLES.map((r) => r.name)).toEqual([
      "Super Admin",
      "Cinema Manager",
      "Event Manager",
      "Finance",
      "Support",
    ]);
  });

  it("only reference permissions from the catalogue", () => {
    for (const { permissions } of SYSTEM_ROLES) {
      for (const permission of permissions) expect(PERMISSIONS).toContain(permission);
    }
  });

  it("give Super Admin every permission", () => {
    expect([...role(SUPER_ADMIN_ROLE)].sort()).toEqual([...PERMISSIONS].sort());
  });

  it("follow the matrix for shows, seat layouts and refunds", () => {
    expect(hasPermission(role("Cinema Manager"), "shows:write")).toBe(true);
    expect(hasPermission(role("Cinema Manager"), "seat-layout:write")).toBe(true);
    expect(hasPermission(role("Cinema Manager"), "refunds:read")).toBe(false);
    expect(hasPermission(role("Event Manager"), "seat-layout:write")).toBe(false);
    expect(hasPermission(role("Event Manager"), "movies:read")).toBe(false);
    expect(hasPermission(role("Finance"), "refunds:approve")).toBe(true);
    expect(hasPermission(role("Support"), "refunds:request")).toBe(true);
    expect(hasPermission(role("Support"), "refunds:approve")).toBe(false);
  });

  it("keep staff management and password resets with Super Admin only", () => {
    for (const { name, permissions } of SYSTEM_ROLES) {
      if (name === SUPER_ADMIN_ROLE) continue;
      expect(hasPermission(permissions, "users:reset-password")).toBe(false);
      expect(hasPermission(permissions, "roles:write")).toBe(false);
    }
  });
});

describe("newPasswordSchema", () => {
  it("needs at least 12 characters", () => {
    expect(newPasswordSchema.safeParse("short-pass1").success).toBe(false);
    expect(newPasswordSchema.safeParse("long-enough-pass").success).toBe(true);
  });

  it("rejects passwords bcrypt would truncate (over 72 bytes)", () => {
    expect(newPasswordSchema.safeParse("a".repeat(72)).success).toBe(true);
    expect(newPasswordSchema.safeParse("a".repeat(73)).success).toBe(false);
    // Multi-byte characters count by bytes, not characters.
    expect(newPasswordSchema.safeParse("€".repeat(25)).success).toBe(false);
  });
});
