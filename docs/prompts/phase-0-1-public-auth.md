# Prompts: Phase 0 (Foundation) + Phase 1 (Public Authentication)

Paste one prompt per fresh Claude Code session (`/clear` first). Each prompt asks Claude to plan first and wait,
so review the plan, answer its questions, then say "go".

**Before 0.1:** the UI conversion must be finished and committed (prompt 0.0).
**Before 0.2:** create a MongoDB Atlas dev cluster (free tier is fine) and put `MONGODB_URI`, `MONGODB_DB` in
`.env.local` yourself. Claude is not allowed to edit `.env*` files.
**Before 1.2 / 1.3:** add `OTP_HASH_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` to `.env.local`
(generate each with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`).

All work happens directly on `main` (no batch branches); one commit per batch.

---

## 0.0 UI conversion sign-off

```text
Batch 0.0 (docs/roadmap.md): sign off the public UI conversion before backend work starts.

Read CLAUDE.md and docs/roadmap.md first.

1. Compare every public page in showBuzz_HTML/*.html (sibling folder ../showBuzz_HTML) against its route in
   src/app/(public)/ using the route map in CLAUDE.md §4. List anything missing or visibly different
   (sections, states, interactions, empty/loading/error states, mobile layout). Don't fix yet; report a table.
2. Run npm run lint, npm run typecheck and npm run build and report the results.
3. Check for leftovers that break CLAUDE.md rules: the "ShowVerse" brand name, FontAwesome, demo OTP 1234,
   process.env outside src/config/env.ts, models/services imported into "use client" files, any, inline styles
   that aren't dynamic values.

Give me the report and a proposed fix list. Wait for my OK before changing anything. When everything is green,
commit the conversion on the current branch with Conventional Commits (group logically, e.g. feat(public): ...).
Do not push.
```

---

## 0.1 Tooling and test harness

```text
Batch 0.1 (docs/roadmap.md): tooling and test harness.

Read CLAUDE.md, docs/roadmap.md (follow "Working rules" and "Definition of Done"), package.json, tsconfig.json,
eslint.config.mjs and next.config.ts. Plan first, wait for my OK.

Approved dev dependencies (exact majors from CLAUDE.md §2; ask before adding anything else):
prettier@3.9, prettier-plugin-tailwindcss@0.8, vitest@5.0, @vitest/coverage-v8, @vitejs/plugin-react,
@testing-library/react@16.3, @testing-library/jest-dom, @testing-library/user-event, jsdom,
mongodb-memory-server@11.3, tsx.

Requirements
1. Prettier: config matching the existing code style (look at line width and quotes in src/ before choosing),
   .prettierignore (.next, node_modules, package-lock.json, showBuzz_HTML, coverage), tailwind plugin pointed at
   src/app/globals.css. Add eslint-config-prettier only if ESLint and Prettier actually conflict (ask first).
   Scripts: format, format:check.
2. Vitest config (vitest.config.mts) with two projects:
   - unit: tests/unit/**, node environment by default, jsdom for *.test.tsx; jest-dom matchers set up.
   - integration: tests/integration/**, node environment, a global setup that starts a MongoMemoryReplSet
     (single node, replica set so transactions work) and exposes its URI via env; stop it on teardown.
   Resolve the @/ alias, and alias "server-only" to a local empty stub (tests/stubs/server-only.ts) because
   it is resolved by Next internally and isn't installed (CLAUDE.md §12).
   Scripts: test (vitest run), test:watch, test:unit, test:integration, test:coverage.
3. Smoke tests proving the harness works, written against existing code (read it first):
   tests/unit/lib/money.test.ts, tests/unit/lib/dates.test.ts (IST display of UTC dates),
   tests/unit/services/pricing.test.ts (GST, convenience fee, coupon min order / max discount if present),
   tests/unit/schemas/auth.test.ts (identifier normalisation), and one tiny integration test that connects to
   the memory server.
   If a test exposes a real bug, stop and report it; don't change production code in this batch.
4. CI: .github/workflows/ci.yml on pull_request and push to main: Node 24, npm ci, lint, typecheck,
   format:check, test, build. Cache npm. No secrets needed yet.
5. Run Prettier over the repo as a separate commit (style: apply prettier) so the tooling commit stays readable.
6. Update CLAUDE.md §5 commands if script names differ, and §12 "Installed vs target versions".

Commits: chore(tooling): add prettier, vitest and ci  →  style: apply prettier  →  test: add smoke tests.
Run the full Definition of Done before finishing.
```

---

## 0.2 Server core

```text
Batch 0.2 (docs/roadmap.md): server core (env, database, HTTP layer, rate limiter).

Read CLAUDE.md (§6, §7, §12), docs/roadmap.md, src/config/env.ts, src/server/http/*, and the Next 16 docs in
node_modules/next/dist/docs/ for route handlers and next.config headers. Plan first, wait for my OK.

Approved dependency: mongoose@9.11. Nothing else.

Requirements
1. Env split. src/config/env.ts becomes server-only (import "server-only") and validates all server vars with
   Zod; add src/config/public-env.ts for NEXT_PUBLIC_* only. Find every importer of env/isDemoMode and make sure
   no client file pulls server env. Add now: MONGODB_URI, MONGODB_DB. Production must fail fast on missing vars;
   make sure `next build` in CI still works (CI workflow passes placeholder values, never real ones).
   Create .env.example listing every variable from CLAUDE.md §6 with comments and empty/placeholder values.
2. src/server/db/connect.ts: cached Mongoose connection on globalThis (survives hot reload and serverless reuse),
   bufferCommands off, sensible serverSelectionTimeoutMS / maxPoolSize, autoIndex only outside production.
   Add scripts/sync-indexes.ts + npm script db:sync-indexes for production index creation.
   Model registration pattern: models.X || model("X", schema) (CLAUDE.md §12).
3. HTTP layer in src/server/http/:
   - Extend AppError codes: UNAUTHENTICATED (401), FORBIDDEN (403), CONFLICT (409), plus keep existing ones.
   - responses.ts: ok(data, meta?, init?) and fail(error) producing the CLAUDE.md §7 envelope.
   - api-handler.ts: apiHandler wrapper for route handlers that optionally parses body/query/params with given Zod
     schemas, maps ZodError → 422 with field errors, AppError → its status (Retry-After header when details carry
     retryAfterSec), unknown → 500 with a generic message, sets x-request-id, and sets Cache-Control: no-store
     unless the handler opts into caching.
   - Keep action-result.ts (Server Actions) consistent with the same codes and messages.
4. src/server/log.ts: tiny structured JSON logger (no new dependency) with level, requestId and automatic
   redaction of keys like password, otp, code, token, secret, authorization, cookie, and masking of phone/email.
   Replace console.error in action-result.ts with it.
5. src/server/http/request.ts: getClientIp(headers) (Vercel x-forwarded-for / x-real-ip, first hop, fallback
   "unknown") and assertSameOrigin(request) for state-changing route handlers (compare Origin, fall back to
   Referer, against NEXT_PUBLIC_APP_URL; reject with 403 FORBIDDEN).
6. Rate limiter: src/server/models/RateLimit.ts (key, windowStart, count, expiresAt with TTL index) and
   src/server/security/rate-limit.ts exposing consumeRateLimit(key, { limit, windowSec }) → { allowed,
   remaining, retryAfterSec }. Atomic: a single upsert with $inc, no read-then-write. Keep the function
   signature storage-agnostic so it can move to Redis later.
7. GET /api/v1/health: returns { status, db: "up" | "down" } via a DB ping, no-store, no internal details.
8. Baseline security headers in next.config.ts headers(): X-Content-Type-Options nosniff, Referrer-Policy
   strict-origin-when-cross-origin, X-Frame-Options DENY, Permissions-Policy (camera only if scan-qr needs it
   later, otherwise none), Strict-Transport-Security in production. CSP is deferred to batch 8.2.

Tests
- unit: apiHandler mapping (Zod 422 with field errors, AppError status, unknown 500 without leaking message,
  request id header), logger redaction, getClientIp, assertSameOrigin.
- integration: consumeRateLimit allows exactly `limit` hits under 20 concurrent calls and reports retryAfterSec;
  connect() reuses the cached connection; health route returns db up.

Docs: CLAUDE.md §6 (env split, new files), §12 (remove items that are no longer true), roadmap tick.
Commit: feat(server): add db connection, api handler, logger and rate limiter.
```

---

## 1.1 Customer data layer

```text
Batch 1.1 (docs/roadmap.md): customer data layer for OTP authentication.

Read CLAUDE.md, docs/roadmap.md (especially "Decisions already taken"), src/schemas/auth.ts,
src/schemas/common.ts, src/server/auth/otp.ts, src/stores/auth.ts and src/config/constants.ts.
Plan first, wait for my OK. No new dependencies.

Requirements
1. Identifier normalisation (src/schemas/auth.ts, reuse common.ts schemas, no duplicates):
   - phone → E.164 "+91XXXXXXXXXX" (accepts 10 digits, +91, 0-prefixed, spaces/dashes);
   - email → trimmed, lowercased;
   - a parsed identifier is a discriminated value { channel: "sms", phone } | { channel: "email", email }.
   Export inferred types. Keep the existing error messages the UI shows.
2. src/server/models/User.ts (collection users):
   name, phone?, email?, phoneVerifiedAt?, emailVerifiedAt?, status ("active" | "blocked" | "deleted"),
   lastLoginAt?, sessions: [{ sid, refreshTokenHash, previousRefreshTokenHash?, rotatedAt?, createdAt,
   lastUsedAt, expiresAt, userAgent?, ipPrefix? }], timestamps.
   Indexes: unique partial index on phone and on email (only when the field exists), index on "sessions.sid".
   toJSON/toObject transforms must strip sessions and any hash; expose a toCustomerSnapshot() helper that returns
   only { id, name, email?, phone?, joinedAt } (this shape replaces CustomerSnapshot in otp.ts).
   Store a coarse IP prefix (/24 for IPv4, /48 for IPv6) rather than the full IP (data minimisation).
3. src/server/models/OtpChallenge.ts (collection otpChallenges):
   channel, identifier (normalised), purpose ("sign_in" | "change_contact"), userId? (for change_contact),
   pendingName? (from the register tab), codeHash, attempts, maxAttempts, expiresAt (TTL index), consumedAt?,
   ipPrefix?, createdAt. Index { identifier, purpose, createdAt }.
4. Move auth constants into src/config/constants.ts (OTP length 6, TTL 5 min, max attempts 5, resend cooldown
   30 s, access token 15 min, refresh token 7 days, max sessions per user 10). Add a "why" comment where useful.
5. Zod schemas for the User/OtpChallenge inputs live in src/schemas/ (auth.ts or user.ts). Mongoose mirrors them
   for persistence rules only.

Out of scope: OTP logic, tokens, UI. Don't touch otp.ts behaviour yet beyond types it must share.

Tests
- unit: phone/email normalisation table (valid, invalid, edge cases like +91 0 prefix, uppercase email).
- integration: duplicate phone and duplicate email are rejected by the unique index; two users without email
  can coexist (partial index); toJSON never contains sessions or hashes; TTL index exists on otpChallenges.expiresAt.

Docs: CLAUDE.md §7 domain model gains otpChallenges and rateLimits. Roadmap tick.
Commit: feat(auth): add user and otp challenge models.
```

---

## 1.2 OTP service on MongoDB

```text
Batch 1.2 (docs/roadmap.md): replace the in-memory OTP service with a MongoDB-backed one.

Read CLAUDE.md, docs/roadmap.md, src/server/auth/otp.ts, src/app/(public)/_actions/auth.ts, the models from
batch 1.1, src/server/security/rate-limit.ts and src/config/env.ts. Plan first, wait for my OK.
No new dependencies.

Requirements
1. Env: OTP_HASH_SECRET (min 32 chars) and OTP_PROVIDER ("dev" for now; Zod refine: "dev" is invalid when
   NODE_ENV=production). Update .env.example and CLAUDE.md §6.
2. src/server/auth/otp-delivery.ts: an OtpSender interface send({ channel, to, code, purpose }).
   DevOtpSender does nothing except allow the code to be returned to the caller as devCode (only when isDemoMode).
   A NotConfiguredSender throws AppError NOT_CONFIGURED (503) and is used in production until a provider is chosen.
   Pick the sender from env in one factory. Never log the code.
3. Rewrite src/server/auth/otp.ts:
   requestOtp(input, ctx: { ip, userAgent, now })
   - parse with Zod; rate limits via consumeRateLimit: per identifier 1 per 30 s (cooldown) and 5 per hour,
     per IP 20 per hour. On limit throw RATE_LIMITED (429) with retryAfterSec in details.
   - invalidate earlier unconsumed challenges for the same identifier + purpose;
   - code = crypto.randomInt, zero-padded to 6; store HMAC-SHA256(OTP_HASH_SECRET, challengeId + code);
   - identical response whether or not an account exists:
     { challengeId, destination (masked: "98******10" / "a***@example.com"), expiresInSec, resendAfterSec, devCode? }.
   verifyOtp(input, ctx)
   - atomically increment attempts with findOneAndUpdate filtered on not consumed, not expired and
     attempts < maxAttempts (no read-then-write); expired/missing → OTP_EXPIRED (410); exhausted → RATE_LIMITED;
   - compare with timingSafeEqual; wrong → OTP_INVALID (401) with remaining attempts in details;
   - consume atomically (set consumedAt only where consumedAt is null) so a code can't be used twice in a race;
   - sign_in purpose: find the user by normalised identifier, or create one (name from pendingName, otherwise
     "ShowBuzz Member"); set phoneVerifiedAt/emailVerifiedAt and lastLoginAt; status blocked/deleted → generic
     UNAUTHENTICATED message (don't reveal the reason);
   - return the user document (sessions are batch 1.3).
   Also add per-IP verify rate limiting (e.g. 30 per 10 min) against distributed guessing across challenges.
4. Update the request/verify Zod schemas (challengeId is an ObjectId string, not a uuid) and the Server Actions
   in src/app/(public)/_actions/auth.ts to pass { ip, userAgent, now } from headers(). Until batch 1.3 the verify
   action keeps returning the customer snapshot so the current UI keeps working; adjust AuthModal only as much as
   needed for the renamed fields.

Tests (integration, memory server; inject `now` instead of faking timers where possible)
- happy path creates a user on first verify and reuses it on the second;
- wrong code decrements remaining attempts; 6th attempt is rejected even with the right code;
- expired code → 410; consumed code can't be reused; two concurrent verifies with the right code: exactly one wins;
- requesting a new code invalidates the old one;
- cooldown and hourly limits return 429 with retryAfterSec;
- the response shape is identical for existing and new identifiers;
- devCode is absent when NODE_ENV=production (and production uses NotConfiguredSender → 503);
- the stored codeHash is not the plain code.

Docs: CLAUDE.md §12 Phase 1 stand-ins note (OTP no longer in memory). Roadmap tick.
Commit: feat(auth): persist otp challenges with rate limits.
```

---

## 1.3 Tokens and sessions

```text
Batch 1.3 (docs/roadmap.md): JWT helpers, session service and cookie helpers for customers.

Read CLAUDE.md §7 Auth flow, docs/roadmap.md "Decisions already taken" (Tokens, Cookies, Silent refresh),
the User model, and node_modules/next/dist/docs/ for cookies(). Plan first, wait for my OK.

Approved dependency: jose@6.2.

Requirements
1. Env: JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (min 32 chars each, refine that they differ). .env.example + §6.
2. src/server/auth/jwt.ts (jose, HS256 pinned in verify options, clockTolerance 5 s):
   signAccessToken({ sub, sid }) and verifyAccessToken(token): iss "showbuzz", aud "showbuzz-public",
   typ "access", 15 min. signRefreshToken({ sub, sid, jti }) and verifyRefreshToken: separate secret, typ "refresh",
   7 days. Verification checks iss, aud and typ, so a refresh token can never pass as an access token and an admin
   token (later aud "showbuzz-admin") never passes as a customer token. Typed result, never throws raw jose errors
   to callers (return null or a typed failure).
   jwt.ts must be importable from proxy.ts: no Mongoose import in this file.
3. src/server/auth/session.ts:
   - createSession(user, ctx) → { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt }; adds a session
     entry with sha256(refresh token) hash; enforces max 10 sessions (evict least recently used).
   - rotateSession(refreshToken, ctx): verify, find user + session by sid, compare hash constant-time.
     Match → issue a new pair and update the hash atomically, conditional on the old hash (protects against
     concurrent rotation); keep previousRefreshTokenHash + rotatedAt.
     Old token presented within 10 s of rotation → treat as a multi-tab race: return the current session's new
     pair (don't revoke). Old token after that window → reuse detected: revoke that session, log a security
     event (no token values), throw UNAUTHENTICATED. Expired/blocked user → UNAUTHENTICATED.
   - revokeSession(userId, sid), revokeAllSessions(userId, exceptSid?).
   - Purge expired session entries opportunistically on write.
4. src/server/auth/cookies.ts: setSessionCookies / clearSessionCookies / readAccessToken / readRefreshToken.
   Access cookie path "/", refresh cookie path "/api/v1/auth", httpOnly, SameSite=Lax, Secure in production,
   __Host- (access) and __Secure- (refresh) name prefixes in production only, maxAge matching token lifetimes.
   Works with both cookies() (Server Actions / route handlers) and NextResponse.
5. No route handlers or UI in this batch.

Tests
- unit (jwt): round trip; expired token rejected; wrong aud rejected; refresh token rejected by
  verifyAccessToken; tampered signature rejected; alg "none" rejected.
- integration (session): create → rotate → old token within 10 s returns current pair → old token after 10 s
  revokes the session; concurrent rotation with the same token doesn't produce two valid sessions; max sessions
  eviction; revokeAll keeps exceptSid; blocked user can't rotate; hashes in DB are not the raw tokens.
- unit (cookies): attributes in dev vs production (prefix, Secure, path, maxAge).

Commit: feat(auth): add jwt helpers and rotating customer sessions.
```

---

## 1.4 Auth API and Server Actions

```text
Batch 1.4 (docs/roadmap.md): customer auth endpoints and Server Actions.

Read CLAUDE.md §7 (API style, Auth flow), docs/roadmap.md, src/server/http/*, src/server/auth/*,
src/app/(public)/_actions/auth.ts, and node_modules/next/dist/docs/ for route handlers, cookies and redirects.
Plan first, wait for my OK. No new dependencies.

Requirements (thin handlers: parse → service → envelope; all wrapped in apiHandler; all no-store)
1. POST /api/v1/auth/customer/otp/request → requestOtp. assertSameOrigin.
2. POST /api/v1/auth/customer/otp/verify → verifyOtp + createSession, sets cookies, returns
   { user: snapshot, accessExpiresAt }. assertSameOrigin.
3. POST /api/v1/auth/refresh → rotateSession from the refresh cookie, sets new cookies, returns
   { user, accessExpiresAt }; on failure clears cookies and returns 401.
   GET /api/v1/auth/refresh?next=<path> → same rotation, then 303 redirect to next on success; on failure clear
   cookies and 303 to "/?auth=signin&next=<path>". Validate next with a shared safeNextPath() in src/lib/
   (relative path only: starts with a single "/", no "//", no backslashes, no scheme, length cap; fallback "/").
   This GET exists so proxy.ts can bounce page navigations through it (refresh cookie is path-scoped).
4. POST /api/v1/auth/logout → revoke the current session if any, clear cookies, always 200 (idempotent).
5. GET /api/v1/auth/me → { user, accessExpiresAt } from the access cookie (check the session sid is still active
   in the DB), 401 UNAUTHENTICATED otherwise.
6. Server Actions in src/app/(public)/_actions/auth.ts mirror request/verify/logout (and a refreshSessionAction is
   NOT possible there because of the cookie path; the client calls POST /api/v1/auth/refresh instead). Actions
   set cookies through the shared helpers and return the ActionResult envelope.
7. Auth failures use generic messages. Rate-limit responses include Retry-After.
8. Create docs/openapi.yaml (OpenAPI 3.1) with the shared envelope/error components and these auth paths.

Tests (integration: call the route handler functions directly with Request objects)
- otp request/verify sets both cookies with correct attributes and returns the snapshot;
- verify with a wrong code → 401 and no cookies set;
- cross-origin POST → 403;
- refresh rotates both cookies; replaying the old refresh token after the grace window → 401 and the session
  is revoked;
- GET refresh redirects to a safe next and rejects "//evil.com", "https://evil.com", "/\\evil.com";
- logout clears cookies and revokes; a second logout still returns 200;
- me → 401 after logout even if the old access token is replayed;
- unit tests for safeNextPath.

Commit: feat(auth): add customer auth endpoints.
```

---

## 1.5 Route protection

```text
Batch 1.5 (docs/roadmap.md): server-side customer guards and proxy.ts for /account/**.

Read CLAUDE.md §7 and §12 (Cache Components, Next 16 proxy), docs/roadmap.md, src/app/(public)/(site)/account/**,
src/components/public/account/*, and node_modules/next/dist/docs/ for proxy.ts (matcher, runtime, redirects) and
for Cache Components / Suspense rules. Plan first, wait for my OK. No new dependencies.

Requirements
1. src/server/auth/current-customer.ts:
   - getCurrentCustomer(): reads and verifies the access cookie, loads the user, confirms the session sid is active
     and the user is active; returns the snapshot or null. Wrap in React cache() so one request does one lookup.
   - requireCustomer(): for Server Actions / route handlers; throws AppError UNAUTHENTICATED.
   - requireCustomerPage(currentPath): for Server Components; redirects to
     /api/v1/auth/refresh?next=<currentPath> when not signed in (the refresh route sends the user on to the
     sign-in modal if refresh fails).
2. src/proxy.ts (Next 16): matcher /account/:path*. Fast check only: verify the access JWT with jwt.ts (no DB).
   Missing/invalid → redirect to /api/v1/auth/refresh?next=<path+search>. Valid → continue.
   Put the decision in a pure function (e.g. decideCustomerRoute) so it can be unit-tested. Leave a clear place
   for /admin/** rules (Phase 5) without implementing them. Exclude _next, static files and api routes.
   proxy.ts is not the security boundary: the account pages still call requireCustomerPage().
3. Account pages (/account/profile, /account/bookings): do the server-side check inside a component wrapped in
   <Suspense> (Cache Components requires dynamic reads to be inside Suspense), with a skeleton fallback matching
   the current loading UI. Pass the snapshot down as props. Keep AccountGate for now (removed in 1.6).
4. Server Actions that are user-specific today (cancelBookingAction, submitReviewAction) don't change yet (1.8).

Tests
- unit: decideCustomerRoute (no cookie, expired token, admin-audience token, valid token, preserves query string).
- integration: getCurrentCustomer returns null for a revoked session and for a blocked user; requireCustomer
  throws 401.
- Verify manually with npm run dev: /account/profile signed out → lands on home with the sign-in modal query;
  report what you observed.

Commit: feat(auth): protect account routes with proxy and server guards.
```

---

## 1.6 Client integration

```text
Batch 1.6 (docs/roadmap.md): connect the public UI to real customer sessions.

Read CLAUDE.md, docs/roadmap.md ("Silent refresh", "Sign-in entry point"), and these files fully before planning:
src/stores/auth.ts, src/stores/hydration.ts, src/stores/ui.ts, src/components/public/layout/AuthModal.tsx,
SiteHeader.tsx, MobileDrawer.tsx, StoreHydrator.tsx, src/app/(public)/layout.tsx,
src/components/public/account/AccountGate.tsx and ProfileDashboard.tsx, CheckoutForm.tsx, ReviewDialog.tsx.
Also the prototype auth modal in ../showBuzz_HTML/assets/js/components.js for UX reference (ignore its demo code).
Plan first, wait for my OK. No new dependencies.

Requirements
1. Auth store: no longer persisted (remove from sessionStorage and from hydration.ts). Shape:
   { status: "unknown" | "authenticated" | "anonymous", user, accessExpiresAt, setSession, clearSession }.
   It is a display snapshot only; it grants nothing.
2. Server-fed initial state: a server component in the public layout, inside <Suspense fallback={null}>, calls
   getCurrentCustomer() and renders a small client component that initialises the store (no extra /me fetch on
   first load, no flash of "Sign in" for signed-in users; header shows a neutral placeholder while status is unknown).
3. useSessionKeepAlive (src/hooks/): schedules POST /api/v1/auth/refresh about 60 s before accessExpiresAt and on
   window focus/visibility if expired; single-flight (one in-flight refresh shared by all callers); on 401 clear
   the store. Also export a withAuthRetry(fn) helper for client code calling auth-required actions: on
   UNAUTHENTICATED it refreshes once and retries, otherwise opens the auth modal.
4. AuthModal on the real API (keep the existing look and the login/register tabs):
   masked destination, resend button with countdown from resendAfterSec, "code expires in" hint, auto-submit when
   all 6 digits are entered, paste support (exists), friendly 429 message with retry time, remaining-attempts
   message, aria-live region for errors, focus management. Dev-only code banner stays and only renders when devCode
   is present. On success: setSession, toast, then router.replace(safe next) if the modal was opened with a next,
   otherwise router.refresh() so server components re-render with the session.
5. Deep link: a client component (inside Suspense, uses useSearchParams) opens the modal when ?auth=signin is
   present and remembers next; it removes the auth/next params from the URL once handled.
6. Sign out (SiteHeader, MobileDrawer, ProfileDashboard): call the logout action, clear the store, toast, and
   router.replace("/") when on an /account page, otherwise router.refresh().
7. Delete src/components/public/account/AccountGate.tsx (approved) and remove its usages; account pages rely on
   the server guard from 1.5. Keep the "sign in to view" empty state only where a page is public but has a
   personalised section.
8. CheckoutForm and ReviewDialog read the snapshot from the new store; behaviour otherwise unchanged (1.8 binds
   them server-side).

Tests
- component tests (Testing Library, mock the actions): sending a code shows the masked destination and countdown;
  resend disabled until the countdown ends; 6 digits auto-submit; error from server rendered in the live region;
  success calls setSession and closes.
- unit: keep-alive single-flight (two concurrent callers → one refresh request), clears store on 401.
- Manual check with npm run dev: sign in, reload (still signed in, no flash), sign out, deep link to
  /account/bookings while signed out → modal → back on /account/bookings. Report what you saw.

Commit: feat(auth): wire public ui to customer sessions.
```

---

## 1.7 Profile and account management

```text
Batch 1.7 (docs/roadmap.md): database-backed profile and account management.

Read CLAUDE.md, docs/roadmap.md (check the open question on account deletion; if it's not answered, ask me),
src/components/public/account/ProfileDashboard.tsx, src/app/(public)/(site)/account/profile/page.tsx,
src/schemas/auth.ts, ../showBuzz_HTML/profile.html, and the auth services. Plan first, wait for my OK.
No new dependencies.

Requirements
1. Profile page loads the profile from the DB (server component inside Suspense, guarded by requireCustomerPage)
   and passes it as props; ProfileDashboard no longer reads the profile from the store.
2. updateProfileAction: name and the other non-identity fields the prototype profile shows (only add a field to
   the User model if the prototype actually has it; list them in the plan). requireCustomer, Zod, returns the new
   snapshot; the client updates the store.
3. Changing email or phone needs verification of the new identifier: startContactChangeAction sends an OTP with
   purpose "change_contact" bound to userId (reuses the OTP service and its rate limits); confirmContactChangeAction
   verifies it and updates the field + verifiedAt. If the identifier belongs to another account → CONFLICT (409)
   with a neutral message. Don't let users remove their last remaining identifier.
4. Sessions: list active sessions (device from user agent, coarse location/IP prefix, last used, "this device"),
   revoke one, and "sign out of all other devices". Revoking the current session behaves like sign-out.
5. Delete account (only if the open question is answered yes): confirm with a fresh OTP, then set status
   "deleted", remove name/phone/email (replace with a tombstone), revoke all sessions, keep bookings/payments
   linked by userId for GST records, sign the user out.
6. All these mutations check that the session is still active in the DB (not just the JWT).

Tests (integration)
- name update persists and returns the new snapshot; invalid input → field errors;
- contact change: wrong code rejected; taken identifier → 409; success updates field and verifiedAt;
  can't remove the last identifier;
- revoke other sessions keeps the current one; revoked session's refresh token no longer works;
- deletion scrubs PII, revokes sessions, and signing in again with the old phone creates a fresh account;
- every action → 401 without a session.

Commit: feat(account): add profile, contact verification and session management.
```

---

## 1.8 Identity in existing features

```text
Batch 1.8 (docs/roadmap.md): bind the existing public features to the signed-in customer.

Read CLAUDE.md, docs/roadmap.md (check the open question "sign in before checkout"; if it's not answered, ask me),
src/server/services/booking.service.ts, review.service.ts, src/app/(public)/_actions/booking.ts and
engagement.ts, src/types/booking.ts, CheckoutForm.tsx, BookingsList.tsx, ReviewDialog.tsx, and the booking pages.
Plan first, wait for my OK. No new dependencies. Bookings and reviews are still in memory (Phase 1 stand-ins);
keep them in memory, only add ownership.

Requirements
1. Bookings: BookingRecord gains userId. placeOrderAction takes the user from requireCustomer() (or follows the
   agreed guest rule); never trust a userId from the client. listBookings(userId) returns only that user's
   bookings; getBooking and cancelBooking check ownership and return NOT_FOUND (404) for other users' bookings so
   existence isn't leaked. Remove the "every demo booking is listed" behaviour and its comment.
2. Checkout: if sign-in is required, the checkout/payment step opens the auth modal (with next back to the same
   step) instead of submitting; contact fields prefill from the session snapshot, and the server uses the
   verified phone/email from the user when present.
3. Booking success page: only the owner can view a booking by code.
4. Reviews: submitReviewAction drops the client-supplied authorName; author comes from the session; sign-in
   required; one review per user per movie (second submit → CONFLICT or update, state which in the plan).
5. Update CLAUDE.md §12 Phase 1 stand-ins accordingly.

Tests
- integration/unit: placing an order without a session → 401 (if sign-in required); user A can't list, view or
  cancel user B's booking (404); review author is taken from the session even if the client sends a name; duplicate
  review rule.
- Manual run of the booking journey signed in and signed out; report results.

Commit: feat(booking): scope bookings and reviews to the signed-in customer.
```

---

## 1.9 Hardening, E2E and documentation

```text
Batch 1.9 (docs/roadmap.md): harden and document customer authentication.

Read CLAUDE.md, docs/roadmap.md and every file under src/server/auth/, src/app/api/v1/auth/, src/proxy.ts,
src/app/(public)/_actions/auth.ts and the auth UI. Plan first, wait for my OK.

Approved dev dependency: @playwright/test@1.64 (plus its Chromium browser download).

Requirements
1. Playwright: playwright.config.ts with a webServer that starts the app against a mongodb-memory-server replica
   set started in global setup (never a real database), Chromium + one mobile viewport. Script test:e2e.
   E2E specs in tests/e2e/auth.spec.ts, reading the dev-only code banner for the OTP:
   - sign in with phone, land back where you started; reload keeps the session;
   - register with email and name; name shows in the header;
   - wrong code shows an error; resend is blocked until the countdown ends;
   - /account/bookings signed out → sign-in modal → returns to /account/bookings;
   - sign out clears the header and /account redirects again.
   Add the e2e job to CI (separate job, only on pull requests).
2. Security review of the whole auth surface against OWASP ASVS v5 (authentication, session management, OTP)
   and OWASP API Top 10. Check at least: enumeration (responses and timing), brute force (per identifier, per IP,
   per challenge), replay of OTP and refresh tokens, JWT alg/aud/typ confusion, cookie flags and prefixes, CSRF
   on every state-changing route and action, open redirects via next, secrets/tokens/OTP in logs or error
   payloads, no-store on user data, blocked/deleted users, session revocation latency (15-min access tokens) and
   that sensitive actions re-check the DB. Write findings as a table (severity, location, fix). Fix high and
   medium findings in this batch; list low ones as follow-ups.
3. docs/auth.md: overview, Mermaid sequence diagrams (OTP sign-in, refresh incl. proxy bounce, logout, reuse
   detection), cookie table, token claims, rate-limit table, threat model summary, how to plug in a real
   SMS/email provider, and the production checklist (provider configured, secrets set per Vercel environment,
   OTP_PROVIDER not "dev").
4. CLAUDE.md: update §5 (test:e2e), §6, §7 Auth flow if anything changed, §12 (remove "OTP codes shown on
   screen" except as the documented dev provider, remove AccountGate mention). Tick Phase 1 in docs/roadmap.md.

Commit(s): test(e2e): add customer auth journey  →  fix(auth): address security review findings  →
docs(auth): document customer authentication.
```
