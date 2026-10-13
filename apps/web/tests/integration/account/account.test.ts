import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmAccountDeletionAction,
  confirmContactChangeAction,
  confirmReauthAction,
  removeContactAction,
  revokeSessionAction,
  signOutOtherDevicesAction,
  startAccountDeletionAction,
  startContactChangeAction,
  startReauthAction,
  updateProfileAction,
} from "@/app/(public)/_actions/account";
import { ACCESS_COOKIE } from "@showbuzz/core/auth/cookies";
import { requestOtp, verifyOtp } from "@showbuzz/core/auth/otp";
import { createSession, rotateSession, type SessionTokens } from "@showbuzz/core/auth/session";
import { connect, disconnect } from "@showbuzz/db/connect";
import { OtpChallenge } from "@showbuzz/db/models/OtpChallenge";
import { RateLimit } from "@showbuzz/db/models/RateLimit";
import { User, type UserDocument } from "@showbuzz/db/models/User";

// Stand-ins for next/headers outside a Next request: a cookie jar and fixed request headers.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string, attrs: { maxAge?: number }) => {
      if (attrs?.maxAge === 0) jar.delete(name);
      else jar.set(name, value);
    },
  }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.30", "user-agent": "vitest" }),
}));

const PHONE = "+919876543210";
const ctx = () => ({ ip: "203.0.113.30", userAgent: "vitest", now: new Date() });

let user: UserDocument;
let current: SessionTokens;

async function signInAs(target: UserDocument) {
  const tokens = await createSession(target, ctx());
  jar.set(ACCESS_COOKIE, tokens.accessToken);
  return tokens;
}

function devCode(result: { success: boolean; data?: unknown }) {
  const data = result.data as { challengeId: string; devCode?: string };
  if (!result.success || !data.devCode) throw new Error(`Expected a code, got ${JSON.stringify(result)}`);
  return { challengeId: data.challengeId, code: data.devCode };
}

const wrong = (code: string) => (code === "000000" ? "111111" : "000000");

beforeAll(async () => {
  await connect();
  await Promise.all([User.init(), OtpChallenge.init(), RateLimit.init()]);
});

beforeEach(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  jar.clear();
  user = await User.create({ name: "Account Tester", phone: PHONE, phoneVerifiedAt: new Date() });
  current = await signInAs(user);
});

afterEach(async () => {
  vi.restoreAllMocks();
  // In-memory test database only (tests/integration/setup.ts refuses any other URI).
  await Promise.all([User.deleteMany({}), OtpChallenge.deleteMany({}), RateLimit.deleteMany({})]);
});

afterAll(async () => {
  await disconnect();
});

describe("updateProfileAction", () => {
  it("saves the name and returns the new snapshot", async () => {
    const result = await updateProfileAction({ name: "  Aarav Roy " });

    expect(result).toEqual({ success: true, data: expect.objectContaining({ id: user.id, name: "Aarav Roy" }) });
    expect((await User.findById(user._id))?.name).toBe("Aarav Roy");
  });

  it("returns field errors for invalid input", async () => {
    const result = await updateProfileAction({ name: "A" });

    expect(result).toMatchObject({
      success: false,
      error: { code: "VALIDATION_FAILED", fieldErrors: { name: ["Name is too short"] } },
    });
  });
});

describe("changing email or phone", () => {
  it("rejects a wrong code, then saves the verified email", async () => {
    const { challengeId, code } = devCode(await startContactChangeAction({ identifier: "Aarav@Example.com" }));

    const bad = await confirmContactChangeAction({ challengeId, code: wrong(code) });
    expect(bad).toMatchObject({ success: false, error: { code: "OTP_INVALID" } });

    const good = await confirmContactChangeAction({ challengeId, code });
    expect(good).toMatchObject({ success: true, data: { email: "aarav@example.com", phone: PHONE } });
    const saved = await User.findById(user._id);
    expect(saved?.email).toBe("aarav@example.com");
    expect(saved?.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it("replaces the phone number after verification", async () => {
    const { challengeId, code } = devCode(await startContactChangeAction({ identifier: "98765 43211" }));

    expect(await confirmContactChangeAction({ challengeId, code })).toMatchObject({
      success: true,
      data: { phone: "+919876543211" },
    });
  });

  it("refuses an identifier that belongs to another account, without saying so", async () => {
    await User.create({ name: "Someone Else", email: "taken@example.com" });

    const result = await startContactChangeAction({ identifier: "taken@example.com" });

    expect(result).toMatchObject({ success: false, error: { code: "CONFLICT" } });
    if (!result.success) expect(result.error.message).not.toMatch(/account|exists|registered/i);
    expect(await OtpChallenge.countDocuments({ identifier: "taken@example.com" })).toBe(0);
  });

  it("refuses the change if someone else took the identifier before confirmation", async () => {
    const { challengeId, code } = devCode(await startContactChangeAction({ identifier: "race@example.com" }));
    await User.create({ name: "Faster Customer", email: "race@example.com" });

    expect(await confirmContactChangeAction({ challengeId, code })).toMatchObject({
      success: false,
      error: { code: "CONFLICT" },
    });
  });

  it("won't accept another user's or another purpose's code", async () => {
    const sent = await requestOtp({ identifier: "other@example.com" }, ctx());
    const signInCode = { challengeId: sent.challengeId, code: sent.devCode ?? "" };

    expect(await confirmContactChangeAction(signInCode)).toMatchObject({
      success: false,
      error: { code: "OTP_EXPIRED" },
    });
  });

  it("never removes the last way to sign in", async () => {
    expect(await removeContactAction({ channel: "sms" })).toMatchObject({
      success: false,
      error: { code: "VALIDATION_FAILED" },
    });
    expect((await User.findById(user._id))?.phone).toBe(PHONE);
  });

  it("removes the email when a phone remains", async () => {
    await User.updateOne({ _id: user._id }, { $set: { email: "aarav@example.com", emailVerifiedAt: new Date() } });

    const result = await removeContactAction({ channel: "email" });

    expect(result.success && result.data).toEqual(expect.not.objectContaining({ email: expect.anything() }));
    const saved = await User.findById(user._id);
    expect(saved?.email).toBeUndefined();
    expect(saved?.emailVerifiedAt).toBeUndefined();
  });
});

describe("sessions", () => {
  it("signs out other devices but keeps this one", async () => {
    const other = await createSession(user, ctx());

    expect(await signOutOtherDevicesAction()).toMatchObject({ success: true });

    const sessions = (await User.findById(user._id))?.sessions ?? [];
    expect(sessions.map((s) => s.sid)).toEqual([current.sid]);
    await expect(rotateSession(other.refreshToken, ctx())).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("revoking this device signs it out and clears its cookies", async () => {
    const result = await revokeSessionAction({ sid: current.sid });

    expect(result).toEqual({ success: true, data: { signedOutHere: true } });
    expect(jar.has(ACCESS_COOKIE)).toBe(false);
    expect(await updateProfileAction({ name: "Too Late" })).toMatchObject({
      success: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("revoking another device leaves this one signed in", async () => {
    const other = await createSession(user, ctx());

    expect(await revokeSessionAction({ sid: other.sid })).toEqual({ success: true, data: { signedOutHere: false } });
    expect((await User.findById(user._id))?.sessions.map((s) => s.sid)).toEqual([current.sid]);
  });
});

describe("account deletion", () => {
  it("scrubs personal data, ends every session, and frees the phone for a new account", async () => {
    await User.updateOne({ _id: user._id }, { $set: { email: "aarav@example.com" } });
    await createSession(user, ctx());
    const { challengeId, code } = devCode(await startAccountDeletionAction());

    expect(await confirmAccountDeletionAction({ challengeId, code })).toEqual({
      success: true,
      data: { deleted: true },
    });

    const tombstone = await User.findById(user._id);
    expect(tombstone).toMatchObject({ status: "deleted", name: "Deleted user", sessions: [] });
    expect(tombstone?.phone).toBeUndefined();
    expect(tombstone?.email).toBeUndefined();
    expect(tombstone?.deletedAt).toBeInstanceOf(Date);
    expect(jar.has(ACCESS_COOKIE)).toBe(false);

    // The deletion code went to the same phone moments ago: the 30 s resend wait applies, as for anyone.
    const later = { ...ctx(), now: new Date(Date.now() + 31_000) };
    const again = await requestOtp({ identifier: PHONE }, later);
    const fresh = await verifyOtp({ challengeId: again.challengeId, code: again.devCode }, later);
    expect(fresh._id.toString()).not.toBe(user._id.toString());
    expect(fresh.name).toBe("ShowBuzz Member");
  });

  it("requires the right code", async () => {
    const { challengeId, code } = devCode(await startAccountDeletionAction());

    expect(await confirmAccountDeletionAction({ challengeId, code: wrong(code) })).toMatchObject({
      success: false,
      error: { code: "OTP_INVALID" },
    });
    expect((await User.findById(user._id))?.status).toBe("active");
  });
});

describe("without a session", () => {
  const challenge = { challengeId: "652f1c0e8b3f4a2d9c1e7b55", code: "123456" };

  it.each([
    ["updateProfileAction", () => updateProfileAction({ name: "Aarav Roy" })],
    ["startContactChangeAction", () => startContactChangeAction({ identifier: "a@example.com" })],
    ["confirmContactChangeAction", () => confirmContactChangeAction(challenge)],
    ["removeContactAction", () => removeContactAction({ channel: "email" })],
    ["revokeSessionAction", () => revokeSessionAction({ sid: "0b5e2f0c-6c1a-4a9e-9f7b-2d3c4e5f6a7b" })],
    ["signOutOtherDevicesAction", () => signOutOtherDevicesAction()],
    ["startAccountDeletionAction", () => startAccountDeletionAction()],
    ["confirmAccountDeletionAction", () => confirmAccountDeletionAction(challenge)],
  ])("%s returns 401", async (_name, action) => {
    jar.clear();
    expect(await action()).toMatchObject({ success: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("rejects a revoked session even with an unexpired access token", async () => {
    await User.updateOne({ _id: user._id }, { $set: { sessions: [] } });
    expect(await updateProfileAction({ name: "Aarav Roy" })).toMatchObject({
      success: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });
});

describe("step-up for sign-in details (security review F2)", () => {
  async function ageSession(minutes: number) {
    const past = new Date(Date.now() - minutes * 60_000);
    await User.updateOne(
      { _id: user._id, "sessions.sid": current.sid },
      { $set: { "sessions.$.createdAt": past }, $unset: { "sessions.$.reauthenticatedAt": "" } },
    );
  }

  it("blocks changing a phone/email on a session older than 10 minutes", async () => {
    await ageSession(11);

    expect(await startContactChangeAction({ identifier: "new@example.com" })).toMatchObject({
      success: false,
      error: { code: "STEP_UP_REQUIRED" },
    });
    expect(await OtpChallenge.countDocuments({ identifier: "new@example.com" })).toBe(0);
  });

  it("blocks removing a phone/email on an old session", async () => {
    await User.updateOne({ _id: user._id }, { $set: { email: "aarav@example.com" } });
    await ageSession(11);

    expect(await removeContactAction({ channel: "email" })).toMatchObject({
      success: false,
      error: { code: "STEP_UP_REQUIRED" },
    });
    expect((await User.findById(user._id))?.email).toBe("aarav@example.com");
  });

  it("allows the change again after a 'confirm it's you' code to the current phone", async () => {
    await ageSession(11);
    const sent = devCode(await startReauthAction());
    expect(await OtpChallenge.findById(sent.challengeId)).toMatchObject({
      identifier: PHONE,
      purpose: "reauthenticate",
    });

    expect(await confirmReauthAction(sent)).toEqual({ success: true, data: { reauthenticated: true } });
    const change = await startContactChangeAction({ identifier: "new@example.com" });
    expect(change.success).toBe(true);
  });

  it("only re-authenticates this device", async () => {
    const other = await createSession(user, ctx());
    await User.updateOne({ _id: user._id }, { $set: { "sessions.$[].createdAt": new Date(Date.now() - 11 * 60_000) } });
    const sent = devCode(await startReauthAction());
    await confirmReauthAction(sent);

    const sessions = (await User.findById(user._id))?.sessions ?? [];
    expect(sessions.find((s) => s.sid === current.sid)?.reauthenticatedAt).toBeInstanceOf(Date);
    expect(sessions.find((s) => s.sid === other.sid)?.reauthenticatedAt).toBeUndefined();
  });
});

describe("contact-change limits come before the 'taken' check (security review F3)", () => {
  it("stops probing whether numbers/emails are taken after 5 tries per hour", async () => {
    await User.create({ name: "Someone Else", email: "taken@example.com" });
    for (let i = 0; i < 5; i++) {
      const result = await startContactChangeAction({ identifier: `probe-${i}@example.com` });
      expect(result.success).toBe(true);
    }

    // Even for a taken identifier, the answer is now the rate limit, not CONFLICT.
    expect(await startContactChangeAction({ identifier: "taken@example.com" })).toMatchObject({
      success: false,
      error: { code: "RATE_LIMITED", details: { retryAfterSec: expect.any(Number) } },
    });
  });
});
