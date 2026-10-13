import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as loginRoute } from "@/app/api/v1/admin/auth/login/route";
import { POST as logoutRoute } from "@/app/api/v1/admin/auth/logout/route";
import { GET as meRoute } from "@/app/api/v1/admin/auth/me/route";
import { GET as refreshGetRoute } from "@/app/api/v1/admin/auth/refresh/route";
import { hashPassword } from "@showbuzz/core/auth/admin/password";
import { seedSystemRoles } from "@showbuzz/core/auth/admin/staff-account.service";
import { signAccessToken as signCustomerAccessToken } from "@showbuzz/core/auth/jwt";
import { connect, disconnect } from "@showbuzz/db/connect";
import { RateLimit } from "@showbuzz/db/models/RateLimit";
import { Role } from "@showbuzz/db/models/Role";
import { Staff } from "@showbuzz/db/models/Staff";

// NEXT_PUBLIC_APP_URL falls back to http://localhost:3000 outside production.
const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";

function request(method: "GET" | "POST", path: string, { cookie, body }: { cookie?: string; body?: unknown } = {}) {
  const headers = new Headers({ origin: ORIGIN, "x-forwarded-for": "203.0.113.40", "user-agent": "vitest" });
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function cookieHeader(response: Response) {
  return response.headers
    .getSetCookie()
    .map((header) => header.split("; ")[0])
    .join("; ");
}

beforeAll(async () => {
  await connect();
  await Staff.init();
});

beforeEach(async () => {
  await seedSystemRoles();
  const role = await Role.findOne({ name: "Super Admin" }).orFail();
  await Staff.create({
    name: "Asha Admin",
    email: "asha@showbuzz.test",
    passwordHash: await hashPassword(PASSWORD, 4),
    roleId: role._id,
  });
});

afterEach(async () => {
  await Promise.all([Staff.deleteMany({}), Role.deleteMany({}), RateLimit.deleteMany({})]);
});

afterAll(async () => {
  await disconnect();
});

describe("admin auth routes", () => {
  it("logs in, sets host-only staff cookies, and /me returns the staff member", async () => {
    const login = await loginRoute(
      request("POST", "/api/v1/admin/auth/login", { body: { email: "asha@showbuzz.test", password: PASSWORD } }),
    );
    expect(login.status).toBe(200);
    const setCookie = login.headers.getSetCookie();
    expect(setCookie.map((c) => c.split("=")[0])).toEqual(["sba_at", "sba_rt", "sba_has_session"]);
    for (const header of setCookie) {
      expect(header.toLowerCase()).not.toContain("domain=");
      expect(header.toLowerCase()).toContain("httponly");
    }
    expect(setCookie.find((c) => c.startsWith("sba_rt="))).toContain("Path=/api/v1/admin/auth");

    const me = await meRoute(request("GET", "/api/v1/admin/auth/me", { cookie: cookieHeader(login) }));
    const body = await me.json();
    expect(me.status).toBe(200);
    expect(body.data.staff).toMatchObject({ email: "asha@showbuzz.test", role: { name: "Super Admin" } });
  });

  it("answers a wrong password with the generic 401", async () => {
    const response = await loginRoute(
      request("POST", "/api/v1/admin/auth/login", { body: { email: "asha@showbuzz.test", password: "nope nope nope" } }),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.message).toBe("Invalid email or password.");
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("rejects a customer token sent in the customer or the staff cookie", async () => {
    const staff = await Staff.findOne({ email: "asha@showbuzz.test" }).orFail();
    const { token } = await signCustomerAccessToken({ sub: staff.id, sid: "s" });
    expect((await meRoute(request("GET", "/api/v1/admin/auth/me", { cookie: `sb_at=${token}` }))).status).toBe(401);
    expect((await meRoute(request("GET", "/api/v1/admin/auth/me", { cookie: `sba_at=${token}` }))).status).toBe(401);
  });

  it("bounces a page navigation without a session to /login with next", async () => {
    const response = await refreshGetRoute(request("GET", "/api/v1/admin/auth/refresh?next=%2Fmovies"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${ORIGIN}/login?next=%2Fmovies`);
  });

  it("logs out and clears the cookies", async () => {
    const login = await loginRoute(
      request("POST", "/api/v1/admin/auth/login", { body: { email: "asha@showbuzz.test", password: PASSWORD } }),
    );
    const cookie = cookieHeader(login);
    const logout = await logoutRoute(request("POST", "/api/v1/admin/auth/logout", { cookie }));
    expect(logout.status).toBe(200);
    expect((await meRoute(request("GET", "/api/v1/admin/auth/me", { cookie }))).status).toBe(401);
  });
});
