# ShowBuzz Build Roadmap

> The working plan for moving ShowBuzz from "UI on seed data" (Phase 1 stand-ins, see CLAUDE.md §12)
> to a production backend. Every Claude Code session reads this file **and** CLAUDE.md before starting a batch.
> Tick a batch only when its Definition of Done is met.

## How batches work

- One batch = one focused, reviewable change (usually 1 PR, 1–3 commits).
- Run each batch in a **fresh Claude Code session** (`/clear` between batches) so context stays small.
- Batches are ordered; don't start one until the previous batch is merged or at least committed.
- Ready-to-paste prompts live in `docs/prompts/`.

## Working rules (apply to every batch)

1. **Read first.** CLAUDE.md, this file, the files you will touch, and the matching guide in
   `node_modules/next/dist/docs/` for any Next.js API you use (proxy, cookies, route handlers, caching).
   Next 16 differs from training data.
2. **Plan, then wait.** Before editing, reply with a short plan: files to add/change, schema/model shapes,
   anything ambiguous. Wait for approval.
3. **Stay in scope.** Do only this batch. Note unrelated issues under "Follow-ups" in the final report; don't fix them.
4. **Dependencies.** Install only the packages the batch prompt names (exact versions from CLAUDE.md §2).
   Ask before adding anything else.
5. **Boundaries.** Zod validates every input (body, query, params, Server Action args, env). Business rules live in
   `packages/core/src/services/`. Route handlers and Server Actions stay thin. Every `packages/core/src/**` module starts with
   `import "server-only"`.
6. **Security baseline.** Never log or return secrets, tokens, OTP codes (except the dev-mode on-screen code), or
   full phone/email in logs. Use constant-time comparisons for secrets. Generic error messages for auth failures.
   No account enumeration. `Cache-Control: no-store` on anything user-specific.
7. **Data.** Money in integer paise, dates in UTC `Date`, display in IST. Indexes declared in the model file.
   Concurrency enforced by unique indexes / atomic updates, never check-then-write.
8. **Tests** (CLAUDE.md §9). Unit tests for logic, integration tests against `mongodb-memory-server`
   (replica set) for models, services and route handlers. Name tests by behaviour.
9. **Docs travel with code.** Update `.env.example`, CLAUDE.md (§6 env, §7 domain model, §12 stand-ins/gotchas),
   `docs/openapi.yaml` for new endpoints, and tick the batch here.

## Definition of Done (every batch)

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` all pass (build matters: Cache Components rules are enforced there).
- [ ] New/changed behaviour covered by tests, including the failure paths.
- [ ] No `any`, no commented-out code, no stray `console.log`.
- [ ] Docs updated (see rule 9).
- [ ] Changes left uncommitted on `main` with a suggested Conventional Commit message, e.g. `feat(auth): ...`. Claude never commits or pushes; the user does.
- [ ] Final report: what changed, how it was verified (commands + results), decisions made, follow-ups.

## Decisions already taken (don't re-litigate)

| Topic               | Decision                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer sign-in    | Phone **or** email + 6-digit OTP. Login and register are one flow: verifying an unknown identifier creates the account (no enumeration).                                                                                                                                                                                                             |
| OTP delivery        | Provider interface (`OtpSender`). Until a provider is chosen (agreed 2026-10-12, temporary): `OTP_PROVIDER=none` (default) writes the code to the server log in every environment so deployed demos work, plus on-screen display outside production; `dev` is on-screen only and rejected in production. Replace with a real provider before launch. |
| OTP storage         | `otpChallenges` collection, code hashed with HMAC-SHA256 (`OTP_HASH_SECRET`), TTL index, max 5 attempts, single use.                                                                                                                                                                                                                                 |
| Rate limiting       | Mongo-backed fixed window (`rateLimits` collection, TTL). Swap for Redis/Upstash later behind the same function.                                                                                                                                                                                                                                     |
| Tokens              | jose HS256. Access JWT 15 min (`aud: showbuzz-public`), refresh JWT 7 days, rotated on every use, stored **hashed** on the user document (one entry per device session, max 10). Reuse of an old refresh token revokes that session; the immediately previous token is tolerated for 10 s to absorb multi-tab races.                                 |
| Cookies             | Access cookie: `httpOnly`, `Secure` (prod), `SameSite=Lax`, path `/`. Refresh cookie: same flags, path `/api/v1/auth` only. `__Host-` / `__Secure-` prefixes in production.                                                                                                                                                                          |
| Silent refresh      | Page navigations: `proxy.ts` bounces to `GET /api/v1/auth/refresh?next=` which rotates and redirects back. Client: a keep-alive hook refreshes shortly before access expiry and on tab focus; auth-required actions that return `UNAUTHENTICATED` refresh once and retry.                                                                            |
| Sign-in entry point | No separate sign-in page. Redirect to `/?auth=signin&next=<path>`; the existing AuthModal opens from that query and returns to a validated `next`.                                                                                                                                                                                                   |
| CSRF                | `SameSite=Lax` cookies + Server Actions' built-in origin check + explicit `Origin` check on state-changing route handlers.                                                                                                                                                                                                                           |
| Social login        | Google/Apple buttons stay "coming soon". Out of scope.                                                                                                                                                                                                                                                                                               |

## Open questions (answer before the batch that needs them)

- ~~**Before 1.8:** sign in before checkout/payment?~~ **Answered 2026-10-13: sign-in required before payment** (no guest checkout). Also decided: one review per customer per movie, a second submit updates it.
- ~~**Before 1.7:** account deletion.~~ **Answered 2026-10-13: yes**, anonymise the user (tombstone) and keep bookings/payments linked by userId for GST records.
- **Before Phase 2:** CLAUDE.md §12 inconsistencies (ticket limit 8 vs 10, cancellation 20 min vs 4 h, coupon codes, city list).
- **Before 3.4:** payment gateway (Razorpay vs Cashfree). **Before go-live:** OTP/SMS + email provider (see `docs/auth.md` §7–8).

---

## Monorepo (pnpm + Turborepo), done 2026-10-13

- [x] **M.1** Convert to a pnpm + Turborepo monorepo (pure restructure): `apps/web` + `packages/{schemas,utils,runtime,db,core,ui,config}`, pnpm catalog, `turbo.json`, tests moved next to their code (306 passing, same as before), docs updated.
- [x] **M.2** `apps/admin` foundation (2026-10-13): admin design system, staff auth with roles (generalised core token/cookie/session helpers), console shell with permission-filtered menu, Ctrl+K palette, dashboard (sample data), profile + password change, Super Admin password reset stand-in. Covers 5.1, 5.2 (without lockout/TOTP) and 5.4. Tests written but not run (2026-10-13: user paused testing); the Playwright admin test was not written.

## Phase 0: Foundation

- [x] **0.0** UI conversion sign-off: audit converted pages against the prototype, all checks green, commit.
- [x] **0.1** Tooling & test harness: Prettier, Vitest (unit + integration projects), Testing Library, mongodb-memory-server, `server-only` stub, CI workflow, smoke tests for existing utils.
- [x] **0.2** Server core: env split (server/public), `.env.example`, Mongoose connection, `apiHandler` + response envelope, extended `AppError`, redacting logger, request helpers (IP, origin check), rate limiter, health route, baseline security headers.

## Phase 1: Public authentication (customer OTP), done 2026-10-13

- [x] **1.1** Customer data layer: `User` + `OtpChallenge` models, identifier normalisation (E.164 / lowercase email), schemas, indexes.
- [x] **1.2** OTP service on MongoDB: delivery provider interface, request/verify, cooldowns, attempts, rate limits, masked destinations.
- [x] **1.3** Tokens & sessions: jose helpers, session service (create, rotate with reuse detection, revoke), cookie helpers.
- [x] **1.4** Auth API + Server Actions: OTP request/verify, refresh (POST + GET bounce), logout, me. OpenAPI doc.
- [x] **1.5** Route protection: `getCurrentCustomer` / `requireCustomer`, `proxy.ts` for `/account/**`, safe `next` redirects.
- [x] **1.6** Client integration: server-fed auth store, AuthModal on real API (resend timer, deep-link open), keep-alive refresh, sign-out, remove `AccountGate`.
- [x] **1.7** Profile & account management: DB-backed profile, verified email/phone change, active sessions, sign out everywhere, account deletion.
- [x] **1.8** Identity in existing features: bookings/reviews/checkout bound to the signed-in user, ownership checks.
- [x] **1.9** Hardening: Playwright E2E for sign-in, security review (OWASP ASVS auth/session), `docs/auth.md`, CLAUDE.md cleanup.

**Phase 1 follow-ups** (from the 1.9 review, `docs/auth.md` §6): CI job for `pnpm test:e2e` (skipped in 1.9; no CI workflow in the repo yet); F5 revoke the old session when re-signing in on the same device; F6 rate-limit bucket for unknown IPs; F7 rate limits on orders, reviews and leads (with 3.4 / 4.1 / 4.3); F8 CSP (8.2); F9 public pages are `no-store` because the layout reads cookies (8.3); seed poster `photo-1579783902614` returns 404 from Unsplash (2.3).

## Phase 2: Catalogue backend

- [ ] **2.1** Reference data + `settings` singleton (cities, languages, genres, pricing/limits) + idempotent `scripts/seed.ts` skeleton.
- [ ] **2.2** Venues, screens, seat layouts (models + seed).
- [ ] **2.3** Movies + events (`kind`) models; seed normalising the prototype catalogues.
- [ ] **2.4** Shows (UTC datetimes, zone pricing) + seed generator.
- [ ] **2.5** Catalogue services on MongoDB replacing `seed-catalog.ts`; `use cache` + cache tags; public read endpoints with pagination/filters.
- [ ] **2.6** Search (text index vs Atlas Search decision), city scoping.

## Phase 3: Booking engine

- [ ] **3.1** Seat availability + seat holds (unique `{showId, seatId}`, TTL), hold/release/extend API, concurrency tests.
- [ ] **3.2** Pricing from `settings`; offers & coupons models + validation rules.
- [ ] **3.3** Food items; server-side order draft and quote.
- [ ] **3.4** Orders + payment gateway integration (after gateway decision).
- [ ] **3.5** Webhooks: signature verification, idempotency, holds → booking in a transaction, payment records.
- [ ] **3.6** Tickets: `bookingCode`, HMAC-signed QR, success page, confirmation email/SMS.
- [ ] **3.7** Cancellation & refunds (cutoff, fee, gateway refund, refund records).
- [ ] **3.8** Gift cards: purchase, balance, redeem.

## Phase 4: Engagement

- [ ] **4.1** Reviews & ratings in DB (moderation status, aggregates).
- [ ] **4.2** Wishlist in DB (merge local wishlist on sign-in).
- [ ] **4.3** Leads (list-your-show, corporate, contact) in DB + staff notification + spam protection.
- [ ] **4.4** Notifications infrastructure (in-app + email).

## Phase 5: Admin authentication & RBAC

- [x] **5.1** `staff` + `roles` models, permission catalogue, seeded roles, bcrypt, `scripts/create-admin.ts`.
- [ ] **5.2** Admin login/refresh/logout (`aud: showbuzz-admin`, separate cookies), lockout, forgot/reset password, optional TOTP 2FA.
- [ ] **5.3** `requirePermission()`, `/admin/**` in `proxy.ts`, activity log service.
- [x] **5.4** Admin shell UI (layout, sidebar, topbar, Ctrl+K, admin tokens) + login/forgot pages.

## Phase 6: Admin CRUD (each batch = UI conversion + API + tests)

- [ ] **6.1** Shared admin kit: data table, form kit, filters, CSV export, media picker.
- [ ] **6.2** Cities, languages, genres. - [ ] **6.3** Movies. - [ ] **6.4** Events / plays / sports / activities / streaming.
- [ ] **6.5** Venues, cinemas, screens. - [ ] **6.6** Seat layout designer + seat management. - [ ] **6.7** Shows scheduler.
- [ ] **6.8** Offers, coupons, gift cards, banners. - [ ] **6.9** CMS pages, SEO, media library. - [ ] **6.10** Users, roles, settings, profile.

## Phase 7: Admin operations

- [ ] **7.1** Bookings & customers. - [ ] **7.2** Scan-QR check-in (idempotent). - [ ] **7.3** Payments & refund approvals.
- [ ] **7.4** Organisers & settlements. - [ ] **7.5** List-your-show workflow. - [ ] **7.6** Review moderation.
- [ ] **7.7** Dashboard, analytics, reports. - [ ] **7.8** Notifications, activity log, backup.

## Phase 8: Production readiness

- [ ] **8.1** Observability (error tracking, structured logs, alerts). - [ ] **8.2** CSP, dependency audit, secret rotation.
- [ ] **8.3** Performance (index review, caching, images, Lighthouse). - [ ] **8.4** SEO (metadata, sitemap, robots, JSON-LD).
- [ ] **8.5** Accessibility audit. - [ ] **8.6** Vercel environments, Atlas backups, runbooks, launch checklist.
