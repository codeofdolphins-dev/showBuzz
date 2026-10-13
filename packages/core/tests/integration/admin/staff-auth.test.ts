import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { adminCookies } from "@showbuzz/core/auth/admin/cookies";
import { requirePermission, requireStaff } from "@showbuzz/core/auth/admin/current-staff";
import { hashPassword } from "@showbuzz/core/auth/admin/password";
import {
  changeOwnPassword,
  resetStaffPassword,
  seedSystemRoles,
} from "@showbuzz/core/auth/admin/staff-account.service";
import {
  currentStaff,
  refreshStaffSession,
  signInStaff,
  signOutStaff,
} from "@showbuzz/core/auth/admin/staff-auth.service";
import { signAccessToken as signCustomerAccessToken } from "@showbuzz/core/auth/jwt";
import { AppError } from "@showbuzz/core/http/app-error";
import { connect, disconnect } from "@showbuzz/db/connect";
import { RateLimit } from "@showbuzz/db/models/RateLimit";
import { Role } from "@showbuzz/db/models/Role";
import { Staff, type StaffDocument } from "@showbuzz/db/models/Staff";

// A fake cookie jar standing in for next/headers' cookies() outside a Next request.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}));

const PASSWORD = "correct horse battery";
const ctx = (now = new Date(), ip = "203.0.113.30") => ({ ip, userAgent: "vitest", now });

let passwordHash: string;
let superAdmin: StaffDocument;
let support: StaffDocument;

beforeAll(async () => {
  await connect();
  await Promise.all([Staff.init(), Role.init()]);
  // Hash once: bcrypt at cost 12 is deliberately slow.
  passwordHash = await hashPassword(PASSWORD);
});

beforeEach(async () => {
  jar.clear();
  await seedSystemRoles();
  const roleId = async (name: string) => (await Role.findOne({ name }).orFail())._id;
  superAdmin = await Staff.create({
    name: "Asha Admin",
    email: "asha@showbuzz.test",
    passwordHash,
    roleId: await roleId("Super Admin"),
  });
  support = await Staff.create({
    name: "Sam Support",
    email: "sam@showbuzz.test",
    passwordHash,
    roleId: await roleId("Support"),
  });
});

afterEach(async () => {
  await Promise.all([Staff.deleteMany({}), Role.deleteMany({}), RateLimit.deleteMany({})]);
});

afterAll(async () => {
  await disconnect();
});

async function expectAppError(promise: Promise<unknown>, status: number, message?: string) {
  const err = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
  if (message) expect((err as AppError).message).toBe(message);
}

describe("signInStaff", () => {
  it("signs in with the right password and returns the role's permissions", async () => {
    const now = new Date();
    const { staff, tokens } = await signInStaff({ email: "ASHA@showbuzz.test", password: PASSWORD }, ctx(now));

    expect(staff).toMatchObject({ id: superAdmin.id, email: "asha@showbuzz.test", role: { name: "Super Admin" } });
    expect(staff.permissions).toContain("users:reset-password");
    expect(JSON.stringify(staff)).not.toContain("Hash");
    expect(tokens.accessToken).toBeTruthy();

    const stored = await Staff.findById(superAdmin._id).orFail();
    expect(stored.lastLoginAt?.getTime()).toBe(now.getTime());
    expect(stored.sessions).toHaveLength(1);
  });

  it("answers a wrong password, an unknown email and a disabled account the same way", async () => {
    await expectAppError(
      signInStaff({ email: "asha@showbuzz.test", password: "wrong password!" }, ctx()),
      401,
      "Invalid email or password.",
    );
    await expectAppError(
      signInStaff({ email: "nobody@showbuzz.test", password: PASSWORD }, ctx()),
      401,
      "Invalid email or password.",
    );
    await Staff.updateOne({ _id: support._id }, { status: "disabled" });
    await expectAppError(
      signInStaff({ email: "sam@showbuzz.test", password: PASSWORD }, ctx()),
      401,
      "Invalid email or password.",
    );
    expect((await Staff.findById(support._id).orFail()).sessions).toHaveLength(0);
  });

  it("rate-limits attempts per email", async () => {
    for (let i = 0; i < 5; i++) {
      await expectAppError(signInStaff({ email: "asha@showbuzz.test", password: "wrong password!" }, ctx()), 401);
    }
    // Even the right password is refused once the limit is reached.
    await expectAppError(signInStaff({ email: "asha@showbuzz.test", password: PASSWORD }, ctx()), 429);
  });

  it("rate-limits attempts per IP across emails", async () => {
    for (let i = 0; i < 20; i++) {
      await expectAppError(
        signInStaff({ email: `guess${i}@showbuzz.test`, password: "wrong password!" }, ctx(new Date(), "198.51.100.7")),
        401,
      );
    }
    await expectAppError(
      signInStaff({ email: "asha@showbuzz.test", password: PASSWORD }, ctx(new Date(), "198.51.100.7")),
      429,
    );
  });
});

describe("staff sessions", () => {
  it("resolves the staff member behind an access token", async () => {
    const { tokens } = await signInStaff({ email: "sam@showbuzz.test", password: PASSWORD }, ctx());
    const current = await currentStaff(tokens.accessToken, new Date());
    expect(current?.staff.role.name).toBe("Support");
    expect(current?.sid).toBe(tokens.sid);
  });

  it("rejects a customer access token, even for an existing id", async () => {
    const { token } = await signCustomerAccessToken({ sub: superAdmin.id, sid: "any-session" });
    expect(await currentStaff(token, new Date())).toBeNull();
  });

  it("rotates the refresh token and revokes the session when an old one is replayed", async () => {
    const start = new Date();
    const first = await signInStaff({ email: "sam@showbuzz.test", password: PASSWORD }, ctx(start));
    const second = await refreshStaffSession(first.tokens.refreshToken, ctx(new Date(start.getTime() + 1000)));
    expect(second.tokens.refreshToken).not.toBe(first.tokens.refreshToken);
    expect(second.tokens.sid).toBe(first.tokens.sid);

    // The first token again, after the 10 s grace window: treated as stolen.
    await expectAppError(
      refreshStaffSession(first.tokens.refreshToken, ctx(new Date(start.getTime() + 60_000))),
      401,
    );
    expect(await currentStaff(second.tokens.accessToken, new Date(start.getTime() + 61_000))).toBeNull();
  });

  it("ends the session on sign-out", async () => {
    const { tokens } = await signInStaff({ email: "sam@showbuzz.test", password: PASSWORD }, ctx());
    await signOutStaff({ accessToken: tokens.accessToken }, new Date());
    expect(await currentStaff(tokens.accessToken, new Date())).toBeNull();
  });
});

describe("requirePermission", () => {
  it("allows a permission the role grants", async () => {
    const { tokens } = await signInStaff({ email: "sam@showbuzz.test", password: PASSWORD }, ctx());
    jar.set(adminCookies.ACCESS_COOKIE, tokens.accessToken);
    expect((await requirePermission("bookings:write")).staff.email).toBe("sam@showbuzz.test");
  });

  it("answers 403 for a permission the role lacks", async () => {
    const { tokens } = await signInStaff({ email: "sam@showbuzz.test", password: PASSWORD }, ctx());
    jar.set(adminCookies.ACCESS_COOKIE, tokens.accessToken);
    await expectAppError(requirePermission("users:reset-password"), 403);
  });

  it("answers 401 without a staff session, including with only a customer cookie", async () => {
    const { token } = await signCustomerAccessToken({ sub: support.id, sid: "x" });
    jar.set("sb_at", token);
    await expectAppError(requireStaff(), 401);
  });
});

describe("password changes", () => {
  it("needs the current password and signs out the other devices", async () => {
    const here = await signInStaff({ email: "sam@showbuzz.test", password: PASSWORD }, ctx());
    const other = await signInStaff({ email: "sam@showbuzz.test", password: PASSWORD }, ctx());
    const actor = { staffId: support.id, sid: here.tokens.sid };

    await expectAppError(
      changeOwnPassword(actor, { currentPassword: "not my password", newPassword: "a brand new password" }),
      422,
    );
    await changeOwnPassword(actor, { currentPassword: PASSWORD, newPassword: "a brand new password" });

    expect(await currentStaff(here.tokens.accessToken, new Date())).not.toBeNull();
    expect(await currentStaff(other.tokens.accessToken, new Date())).toBeNull();
    const { staff } = await signInStaff({ email: "sam@showbuzz.test", password: "a brand new password" }, ctx());
    expect(staff.id).toBe(support.id);
  });

  it("lets a Super Admin set a temporary password that ends the target's sessions", async () => {
    const before = await signInStaff({ email: "sam@showbuzz.test", password: PASSWORD }, ctx());
    const { temporaryPassword } = await resetStaffPassword({ staffId: superAdmin.id }, { email: "sam@showbuzz.test" });

    expect(await currentStaff(before.tokens.accessToken, new Date())).toBeNull();
    const { staff } = await signInStaff({ email: "sam@showbuzz.test", password: temporaryPassword }, ctx());
    expect(staff.id).toBe(support.id);
    await expectAppError(resetStaffPassword({ staffId: superAdmin.id }, { email: "asha@showbuzz.test" }), 409);
  });
});

describe("seedSystemRoles", () => {
  it("is idempotent and keeps edits to non-system-admin roles", async () => {
    await Role.updateOne({ name: "Support" }, { permissions: ["bookings:read"] });
    const again = await seedSystemRoles();
    expect(again.created).toEqual([]);
    expect(await Role.countDocuments()).toBe(5);
    expect((await Role.findOne({ name: "Support" }).orFail()).permissions).toEqual(["bookings:read"]);
  });
});
