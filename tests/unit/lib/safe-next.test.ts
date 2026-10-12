import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-next";

describe("safeNextPath", () => {
  it.each(["/", "/account/bookings", "/movies/chrono-nexus-origins?date=2026-10-12#showtimes", "/%2F%2Fevil.com"])(
    "keeps the local path %s",
    (path) => {
      expect(safeNextPath(path)).toBe(path);
    },
  );

  it.each([
    ["scheme-relative", "//evil.com"],
    ["absolute https", "https://evil.com"],
    ["javascript:", "javascript:alert(1)"],
    ["backslash", "/\\evil.com"],
    ["backslash-led", "\\\\evil.com"],
    ["tab inside", "/\t/evil.com"],
    ["newline inside", "/account\n/evil"],
    ["relative without slash", "account"],
    ["empty", ""],
    ["over-long", `/${"a".repeat(600)}`],
  ])("rejects %s", (_label, value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it("rejects non-strings and supports a custom fallback", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(["/a"])).toBe("/");
    expect(safeNextPath("//evil.com", "/account/profile")).toBe("/account/profile");
  });
});
