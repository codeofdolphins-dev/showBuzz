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

Done as **Prompt A** (`docs/prompts/phase-2-public-backend.md`, 2026-10-13); verified with lint + typecheck + build only (tests deferred).

- [x] **2.1** `settings` singleton + cities + idempotent `pnpm db:seed` (`packages/db/scripts/seed.ts`). Languages/genres stay plain strings on movies (no collections yet).
- [x] **2.2** Venues with embedded screens and seat layouts (cinemas, stadiums, event venues).
- [x] **2.3** Movies + events (`kind`) models; seeded from the public prototype catalogue (the admin catalogue is reconciled with the admin app).
- [x] **2.4** Shows (UTC `startsAt`, zone prices) + idempotent generator, run lazily from showtimes and by the seed.
- [x] **2.5** Catalogue services on MongoDB (`seed-catalog.ts` moved to `scripts/seed-data.ts`), `use cache` + per-collection tags + `revalidateCatalog()`. Public REST read endpoints with pagination/filters: not built (pages read services directly); add with the admin/API work.
- [~] **2.6** Search: Server Action with escaped case-insensitive substring match (no text/Atlas Search index yet). City scoping not done (the city picker doesn't filter listings yet).

**Prompt A follow-ups:** admin needs a protected revalidate route on the web app (`revalidateTag` doesn't cross deployments); UI copy and SeatSelector limits still read constants, not Settings; skipped tests (`pricing.test.ts` › quoteOrder, `ownership.test.ts`) need seeded catalogue fixtures; city scoping for listings.

## Phase 3: Booking engine

Prompt B (`docs/prompts/phase-2-public-backend.md`, 2026-10-13) built the booking engine on a simulated gateway; verified with lint + typecheck + build only (tests deferred).

- [x] **3.1** Seat holds (unique `{showId, seatId}` + TTL, browser hold cookie, insertMany + rollback on conflict) and tier passes (conditional `$inc` on the pass show). As Server Actions, no REST API yet; concurrency tests deferred.
- [x] **3.2** Pricing from `settings`; coupons in MongoDB with the existing validation rules (done in Prompt A).
- [x] **3.3** Food items in MongoDB; server-side quote (Prompt A) and re-pricing at order time.
- [~] **3.4** Orders (`bookings`, `payments`) behind a `PaymentGateway` interface with `SimulatedGateway` (`PAYMENT_PROVIDER=simulated`, allowed in production). Real gateway still open.
- [~] **3.5** Server-side confirmation, idempotent, holds → sold in a transaction, payment records. Webhooks + signature verification come with the real gateway.
- [~] **3.6** Tickets: `bookingCode`, HMAC-signed QR (SVG on the success page and in My Bookings, `verifyTicketPayload()` for scan-qr) done in Prompt C. Confirmation email/SMS waits for a provider.
- [x] **3.7** Cancellation & refunds (Settings cutoff and fee, transaction, `refunds` record, simulated gateway refund). Only `bookingCode` of 3.6 is done; QR is Prompt C.
- [x] **3.8** Gift cards (Prompt D, 2026-10-13): purchase creates the card in the confirm transaction, embedded ledger, redeem at checkout (rate-limited lookups, balance spent only on confirmation), refunds return the card share, profile "My Gift Cards". Delivery by email/SMS waits for a provider.

## Phase 4: Engagement

- [x] **4.1** Reviews & ratings in DB (Prompt C): one per customer per movie, `status` field (all published until moderation in admin), movie aggregate updated in a transaction.
- [x] **4.2** Wishlist in DB (Prompt C): merged from the device once at sign-in, optimistic toggles.
- [~] **4.3** Leads in DB with per-IP rate limit and honeypot (Prompt C). Staff notification waits for the admin app / email provider.
- [ ] **4.4** Notifications infrastructure (in-app + email).

## Marketplace back office (`docs/prompts/phase-3-admin.md`)

Multi-vendor rebuild of the back office: super-admin console (admin.showbuzz.com) + vendor portal (partner.showbuzz.com).
Phases 6 and 7 below are largely replaced by these prompts.

- [x] **B.1** Marketplace data model (2026-10-14): `vendors` (KYC, billing model, rates, cancellation policy), `vendorUsers`, `plans`; `vendorId` on venues, events, shows, bookings, payments, refunds, food items and (optional) coupons; `createdByVendorId` on movies. Pricing uses the show vendor's rates, bookings store a settlement snapshot and the vendor's cancellation policy, vendor coupons only apply to that vendor's shows, the food step lists the show vendor's menu. KYC files in GridFS behind `FileStorage`. Seed: 3 demo vendors + backfill. Verified with lint + typecheck + build (tests deferred).
- [x] **B.2** Shared console kit + partner app + vendor signup and onboarding (2026-10-14): `packages/console-ui` (shell, page parts, form primitives and fields incl. IST date/time and rupee↔paise money input, DataTable + FilterBar over URL params, confirm dialog, status badge, toasts; admin moved onto it unchanged); `POST /api/internal/revalidate` on web + `revalidateWeb(tags)` (`REVALIDATE_SECRET`, `WEB_APP_URL`); `activityLogs` + `logActivity()`; `apps/partner` (:3002, partner.showbuzz.com) with vendor auth on the shared token/session/cookie factories (aud `showbuzz-partner`, `sbp_*`), `/signup` with mobile OTP, mandatory KYC onboarding (business → GSTIN/PAN → bank → documents → review, no approval), partner shell with "Coming soon" pages, dashboard billing summary, profile + password change; `defaultCommissionBps` in Settings; `db:create-vendor-user`, `db:seed-demo-vendors` (dev). Verified with lint + typecheck + build (tests deferred).
- [x] **B.3** Partner: venues, screens, seat layout designer (2026-10-14): `/venues` (list, search, filters for type/city/status, create/edit: kind, name, slug, city, address, box office phone, amenities, venue cancellations on/off, active/inactive), venue detail with its screens (add/edit: name, layout type, formats, sound system; a new screen gets a starter layout; remove only without upcoming shows), Seat Layout Designer at `/venues/[id]/screens/[screenId]/layout` (categories with colour, recliner flag and default price; rows per category with seat count; click/drag-select to block seats, mark wheelchair spots, add aisles and move rows; no new dependency), `/seat-layouts` (every screen's layout + live seat manager per show: sold / in checkout / awaiting payment / blocked, block and unblock seats for one show, release a stuck hold). A layout save is refused, with the affected shows listed, if it would remove, block or re-categorise a seat sold or held for an upcoming show; saves are conditional on the venue's `updatedAt`. Venues gained `status` and `phone`, screens `formats`/`soundSystem`, categories `defaultPricePaise` and more colours, rows `aislesAfter[]` and `blockedSeats[]`; per-show blocks are `seatHolds` with status `blocked`. Inactive venues are hidden publicly; the public seat map shows blocked seats as unavailable. Seed writes venue profiles and screens on first insert only and backfills the new layout fields. Verified with lint + typecheck + build (tests deferred).
- [ ] **B.4** Partner: movies, events, shows, pricing.
- [ ] **B.5** Partner: bookings, QR scan, food menu, offers, cancellation policy, earnings.
- [ ] **B.6** Admin: vendors, plans, subscriptions, payouts (who keeps the cancellation fee), movie merge, hiding suspended vendors' listings.
- [ ] **B.7** Admin: platform operations and content. - [ ] **B.8** Admin: dashboard, reports, notifications.

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
