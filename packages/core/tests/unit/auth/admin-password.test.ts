import { describe, expect, it } from "vitest";
import {
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
} from "@showbuzz/core/auth/admin/password";
import { newPasswordSchema } from "@showbuzz/schemas/staff";

describe("staff password hashing", () => {
  it("hashes with bcrypt at cost 12 and verifies the right password only", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(hash).not.toContain("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse battery!", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    const [a, b] = await Promise.all([hashPassword("same password 1", 4), hashPassword("same password 1", 4)]);
    expect(a).not.toBe(b);
  });

  it("generates temporary passwords that meet the policy and don't repeat", () => {
    const passwords = new Set(Array.from({ length: 20 }, generateTemporaryPassword));
    expect(passwords.size).toBe(20);
    for (const password of passwords) expect(newPasswordSchema.safeParse(password).success).toBe(true);
  });
});
