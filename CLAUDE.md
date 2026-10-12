# CLAUDE.md

> Project instructions for Claude Code. Keep this file accurate: outdated info is worse than none.
> Last reviewed: 2026-10-10. Library versions below are the latest stable releases on npm as of that date.

## 1. Project Overview

- **Name:** ShowBuzz (repo/folder: `showBuzz`)
- **Purpose:** A multi-city entertainment discovery and ticket-booking platform (in the style of BookMyShow) for movies, live events, plays, sports, activities and streaming, with a full back-office console for operators, cinema managers, event organisers and finance staff.
- **Type:** Full-stack web app. One Next.js app with three areas: **public** (customer site), **admin** (operations console), **api** (REST route handlers).
- **Status:** Prototype → production rebuild. A static HTML/Tailwind/Vanilla-JS prototype exists in `showBuzz_HTML/` and is the **design and behaviour reference**. The Next.js app is being built from it.
- **Market defaults:** India. Currency INR (₹), timezone `Asia/Kolkata` (IST), default city Kolkata. GST and convenience fees apply to every order.

### Reference prototype (`showBuzz_HTML/`)

| Area          | Location                                 | Prototype brand   | Notes                                                                                                                                                               |
| ------------- | ---------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public site   | `showBuzz_HTML/*.html` (31 pages)        | "ShowVerse"       | Tailwind CDN, Swiper, FontAwesome, Plus Jakarta Sans. Data in `assets/js/data.js`, state in `assets/js/store.js` (localStorage).                                    |
| Admin console | `showBuzz_HTML/admin/*.html` (~55 pages) | "ShowPilot Admin" | Tailwind CDN, Lucide, Chart.js, Quill, SortableJS. Data seeded from `admin/assets/js/storage.js` + `admin/data/*.json`; fake async API in `admin/assets/js/api.js`. |

Treat the prototype as read-only reference. Do not edit it while building the Next.js app. The prototype brand names (ShowVerse / ShowPilot) are placeholders: the product name is **ShowBuzz** everywhere in new code.

## 2. Tech Stack

| Layer           | Technology                                                                            | Version                                                         |
| --------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Language        | TypeScript (strict)                                                                   | 7.0.x                                                           |
| Runtime         | Node.js                                                                               | 24 LTS (minimum); move to 26 once it enters LTS (late Oct 2026) |
| Framework       | Next.js (App Router, Turbopack)                                                       | 16.4.x                                                          |
| UI library      | React / React DOM                                                                     | 19.3.x                                                          |
| Backend         | Next.js Route Handlers (`app/api/**/route.ts`) + Server Actions where appropriate     | —                                                               |
| Database        | MongoDB (Atlas, replica set required for transactions)                                | 8.x server; `mongodb` driver 7.7.x (via Mongoose)               |
| ODM             | Mongoose                                                                              | 9.11.x                                                          |
| Validation      | Zod                                                                                   | 4.6.x                                                           |
| Auth            | JWT (`jose`, HS256) in httpOnly cookies; `bcryptjs` for admin passwords               | jose 6.2.x, bcryptjs 3.0.x                                      |
| Styling         | Tailwind CSS v4 (CSS-first config, `@tailwindcss/postcss`)                            | 4.3.x                                                           |
| Client state    | Zustand                                                                               | 5.0.x                                                           |
| Forms           | React Hook Form + `@hookform/resolvers` (Zod)                                         | 7.89.x / 5.9.x                                                  |
| Testing         | Vitest, Testing Library, Playwright, mongodb-memory-server                            | 5.0.x / 16.3.x / 1.64.x / 11.3.x                                |
| Lint / format   | ESLint (flat config) + `eslint-config-next`, Prettier + `prettier-plugin-tailwindcss` | 10.12.x / 16.4.x, 3.9.x / 0.8.x                                 |
| Package manager | npm                                                                                   | 12.x                                                            |
| Hosting / CI    | Vercel (preview per PR, production on `main`)                                         | —                                                               |

**State management decision:** Zustand is the client-state library. Redux Toolkit (2.13.x) is _not_ used; do not add it unless explicitly agreed. Server data is fetched in Server Components; Zustand holds only client/UI state (selected city, seat selection, cart, auth snapshot, UI toggles).

**Package manager decision:** npm. Commit only `package-lock.json`. Do not mix in `yarn.lock` (if the team switches to Yarn 4.x, replace npm everywhere in one change).

## 3. Key Libraries

- `next`: App Router, Server Components, Route Handlers, `proxy.ts` (Next 16 replacement for `middleware.ts`).
- `mongoose`: all DB access goes through models in `src/server/models/`. No raw driver calls outside `src/server/db/`.
- `zod`: single source of truth for input shapes. Every API body, query string, route param, form and env var is validated with a Zod schema from `src/schemas/`. Infer TS types with `z.infer`, don't hand-write duplicates.
- `jose`: sign/verify JWTs (works in both Node and Edge runtimes, so it can run inside `proxy.ts`). Do not use `jsonwebtoken`.
- `bcryptjs`: hash admin/staff passwords (cost 12).
- `zustand`: client stores in `src/stores/`. Use `useShallow` for multi-field selectors.
- `react-hook-form` + `@hookform/resolvers/zod`: all non-trivial forms (admin CRUD forms, checkout, profile).
- `tailwindcss` v4: theme tokens live in CSS (`@theme`) in `src/app/globals.css`, not in `tailwind.config.js`.
- `lucide-react`: icon set for **both** public and admin (replaces FontAwesome and Lucide CDN from the prototype).

Candidate libraries for prototype features (ask before installing):

- `swiper` (14.x): public hero/carousels.
- `chart.js` + `react-chartjs-2`: admin dashboard/analytics charts.
- `@dnd-kit/core`: drag-and-drop ordering (banners, seat layout designer).
- `qrcode`: M-ticket QR generation (server-side, signed payload).
- `sonner`: toast notifications.
- Rich text editor for CMS pages (prototype used Quill): choose one with the team.
- Payment gateway SDK (Razorpay or Cashfree): not decided yet.

**Do not add** new dependencies without asking. Prefer what is already installed.

## 4. Project Structure

The frontend is split into three areas: **public**, **admin**, **api**.

```
showBuzz/
├── src/
│   ├── app/
│   │   ├── (public)/                 # Customer site (route group: no URL prefix)
│   │   │   ├── layout.tsx            # City/auth modals, toaster, store hydration (all public pages)
│   │   │   ├── _actions/             # Server Actions used by public client islands
│   │   │   ├── (focus)/booking/[showId]/seats/  # Full-screen seat map (no site header/footer)
│   │   │   └── (site)/               # Every other public page; its layout adds header, footer, bottom nav
│   │   │       # The routes below live inside (site)/
│   │   │   ├── page.tsx              # Home
│   │   │   ├── movies/               # /movies, /movies/[slug]
│   │   │   ├── cinemas/              # /cinemas (showtimes for a movie/date)
│   │   │   ├── events/  plays/  sports/  activities/   # listing + [slug] details
│   │   │   ├── stream/  offers/  gift-cards/
│   │   │   ├── booking/              # /booking/[showId]/seats, /booking/food, /booking/checkout,
│   │   │   │                         # /booking/payment, /booking/success, /booking/failure
│   │   │   ├── account/              # /account/profile, /account/bookings (auth required)
│   │   │   ├── list-your-show/  corporate/  contact/  faq/
│   │   │   └── about/  privacy/  terms/
│   │   ├── admin/                    # Operations console (URL prefix /admin)
│   │   │   ├── (auth)/               # /admin/login, /admin/forgot-password (no sidebar)
│   │   │   └── (console)/            # Authenticated layout: sidebar, topbar, Ctrl+K search
│   │   │       ├── dashboard/  analytics/  reports/  notifications/  activity-log/
│   │   │       ├── movies/  events/  plays/  sports/  activities/  streaming/
│   │   │       ├── venues/  cinemas/  screens/  seat-layout/  seat-management/  shows/
│   │   │       ├── bookings/  customers/  scan-qr/
│   │   │       ├── organisers/  list-your-show/
│   │   │       ├── payments/  refunds/  settlements/
│   │   │       ├── offers/  coupons/  gift-cards/  banners/  reviews/
│   │   │       ├── cities/  languages/  genres/  media-library/  pages/  seo/
│   │   │       └── users/  roles/  settings/  profile/  backup/
│   │   │           # each resource: page.tsx (list), new/page.tsx, [id]/page.tsx, [id]/edit/page.tsx
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── auth/             # customer OTP + admin login/refresh/logout
│   │   │       ├── public/           # read endpoints + booking flow (holds, orders, payments)
│   │   │       ├── admin/            # CRUD + operations, RBAC-protected
│   │   │       └── webhooks/         # payment gateway callbacks (signature-verified)
│   │   ├── globals.css               # Tailwind v4 import + @theme tokens (public + admin)
│   │   ├── layout.tsx                # Root layout (fonts, metadata)
│   │   └── not-found.tsx
│   ├── proxy.ts                      # Route protection for /admin/** and /account/** (Next 16)
│   ├── components/
│   │   ├── ui/                       # Shared primitives (Button, Input, Modal, Badge, Table, Skeleton)
│   │   ├── public/                   # Public-only components, grouped by feature (movie/, booking/, seat-map/ ...)
│   │   └── admin/                    # Admin-only components (sidebar/, data-table/, forms/, charts/, seat-designer/)
│   ├── schemas/                      # Zod schemas shared by API, forms and services (movie.ts, booking.ts ...)
│   ├── server/                       # Server-only code (import "server-only" at the top of each module)
│   │   ├── db/connect.ts             # Cached Mongoose connection (globalThis cache for serverless)
│   │   ├── models/                   # Mongoose models, one per file (Movie.ts, Show.ts, Booking.ts ...)
│   │   ├── services/                 # Business logic (booking.service.ts, pricing.service.ts, seat-hold.service.ts)
│   │   ├── auth/                     # jwt.ts, session.ts, password.ts, rbac.ts
│   │   ├── http/                     # apiHandler wrapper, AppError, response helpers, request helpers
│   │   ├── security/                 # rate-limit.ts (and later: CSRF/abuse helpers)
│   │   └── log.ts                    # Structured JSON logger with redaction
│   ├── stores/                       # Zustand stores (city, booking-cart, auth, ui)
│   ├── hooks/                        # Client hooks
│   ├── lib/                          # Framework-agnostic utils (money.ts, dates.ts, slug.ts, cn.ts)
│   ├── types/                        # Shared TS types not inferred from Zod
│   └── config/
│       ├── env.ts                    # Zod-validated process.env (fail fast on boot)
│       └── constants.ts              # Business constants (see §7)
├── tests/
│   ├── unit/                         # Vitest (services, schemas, utils)
│   ├── integration/                  # Vitest + mongodb-memory-server (route handlers, models)
│   └── e2e/                          # Playwright (booking journey, admin login/CRUD)
├── public/                           # Static assets, manifest, icons
├── scripts/                          # seed.ts (ports prototype data), create-admin.ts
├── showBuzz_HTML/                    # Read-only prototype reference (or kept in a sibling folder)
├── .env.example
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

**Where things go**

- New public page → `src/app/(public)/<route>/page.tsx`; its components → `src/components/public/<feature>/`.
- New admin page → `src/app/admin/(console)/<resource>/...`; its components → `src/components/admin/<feature>/`.
- New API endpoint → `src/app/api/v1/{auth|public|admin|webhooks}/<resource>/route.ts`. Keep handlers thin: parse with Zod → call a service → return the response envelope.
- New collection → `src/server/models/<Name>.ts` + Zod schema in `src/schemas/<name>.ts` + seed data in `scripts/seed.ts`. Add indexes in the model file.
- Business rules → `src/server/services/`, never in components or route handlers.
- Shared types → infer from Zod in `src/schemas/`; only non-schema types go in `src/types/`.
- Component used by both public and admin → `src/components/ui/`.

### Prototype → Next.js route map

| Prototype file                                                                         | Next.js route                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `index.html`                                                                           | `/`                                                                                   |
| `movies.html`, `movie-details.html`                                                    | `/movies`, `/movies/[slug]`                                                           |
| `cinemas.html`                                                                         | `/cinemas?movie=<slug>&date=<yyyy-mm-dd>`                                             |
| `seat-selection.html`                                                                  | `/booking/[showId]/seats`                                                             |
| `food.html`, `checkout.html`, `payment.html`                                           | `/booking/food`, `/booking/checkout`, `/booking/payment`                              |
| `booking-success.html`, `booking-failure.html`                                         | `/booking/success?id=`, `/booking/failure`                                            |
| `events.html` / `plays.html` / `sports.html` / `activities.html` (+ `*-details.html`)  | `/events`, `/plays`, `/sports`, `/activities` (+ `/[slug]`)                           |
| `stream.html`, `offers.html`, `gift-cards.html`                                        | `/stream`, `/offers`, `/gift-cards`                                                   |
| `profile.html`, `bookings.html`                                                        | `/account/profile`, `/account/bookings`                                               |
| `admin/login.html`, `admin/forgot-password.html`                                       | `/admin/login`, `/admin/forgot-password`                                              |
| `admin/<resource>.html`, `admin/<resource>-form.html`, `admin/<resource>-details.html` | `/admin/<resource>`, `/admin/<resource>/new` & `/[id]/edit`, `/admin/<resource>/[id]` |

## 5. Commands

```bash
# Install (Node >= 24)
npm install

# Development server (Turbopack)
npm run dev                  # next dev

# Build / start
npm run build                # next build
npm run start                # next start

# Lint / format  (Next 16 removed `next lint`; ESLint runs directly)
npm run lint                 # eslint .
npm run format               # prettier --write .
npm run format:check         # prettier --check .  (CI)

# Type check
npm run typecheck            # next typegen && tsc --noEmit  (or tsgo --noEmit with TS 7)

# Tests  (Vitest projects: unit = node, unit-dom = jsdom for *.test.tsx, integration = mongodb-memory-server)
npm test                     # vitest run (all projects)
npm test -- tests/unit/services/pricing.test.ts   # single file
npm run test:unit            # unit + unit-dom
npm run test:integration     # in-memory replica set; first run downloads mongod
npm run test:watch           # vitest (watch mode)
npm run test:coverage        # v8 coverage over src/**
npm run test:e2e             # playwright test (not set up yet)

# Database
npm run db:seed              # tsx scripts/seed.ts   (ports prototype data into MongoDB)
npm run db:create-admin      # tsx scripts/create-admin.ts
npm run db:sync-indexes      # build/drop indexes to match the models (run before deploying index changes)
```

There are no migrations (MongoDB). Schema changes are handled in Mongoose models; data backfills go in `scripts/` as one-off, idempotent scripts.

Always run **lint, typecheck, and tests** before declaring a task complete.

## 6. Environment & Configuration

- Copy `.env.example` to `.env.local` for local development. On Vercel, set the same variables per environment (Development / Preview / Production).
- Env vars are parsed with Zod in two files; never read `process.env` anywhere else:
  - `src/config/env.ts` (`import "server-only"`): server variables, validated when first imported, so a missing or malformed variable fails boot and `next build` (the error names the variable, never its value). Exports `env`, `isProduction`, `isDemoMode`. Add a variable here (and to `.env.example`) when the code that needs it lands.
  - `src/config/public-env.ts`: `NEXT_PUBLIC_*` only, safe for client components (`publicEnv.NEXT_PUBLIC_APP_URL`, `publicEnv.appOrigin`). `NEXT_PUBLIC_APP_URL` is required in production and defaults to `http://localhost:3000` otherwise.
- Validated today: `MONGODB_URI`, `MONGODB_DB`, `OTP_HASH_SECRET` (≥32 chars), `OTP_PROVIDER` (optional: `none` default | `dev`, not allowed in production), `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (≥32 chars each, must differ), `NEXT_PUBLIC_APP_URL` (+ Vercel's own `VERCEL_URL` / `VERCEL_BRANCH_URL`, used to accept preview deployment origins). `next build` validates them too, so any build environment needs real or placeholder values; tests set their own (see §12).
- Required variables (full list, also in `.env.example`):
  - `MONGODB_URI`: MongoDB Atlas connection string (replica set; needed for transactions).
  - `MONGODB_DB`: database name (e.g. `showbuzz_dev`, `showbuzz_prod`).
  - `JWT_ACCESS_SECRET`: ≥32-byte secret for access tokens.
  - `JWT_REFRESH_SECRET`: ≥32-byte secret for refresh tokens (different from access).
  - `QR_SIGNING_SECRET`: HMAC-SHA256 key for signing ticket QR payloads.
  - `NEXT_PUBLIC_APP_URL`: canonical site URL (used for cookies, links, SEO).
  - `PAYMENT_KEY_ID`, `PAYMENT_KEY_SECRET`, `PAYMENT_WEBHOOK_SECRET`: payment gateway credentials (gateway TBD: Razorpay or Cashfree).
  - `OTP_HASH_SECRET`: HMAC key for OTP codes at rest.
  - `OTP_PROVIDER` + `OTP_PROVIDER_*`: SMS/email OTP delivery (provider TBD; until then `none` logs the code, see §12).
  - `MEDIA_STORAGE_*`: image/media storage credentials (provider TBD).
- Only variables prefixed `NEXT_PUBLIC_` reach the browser. Never put secrets in them.
- **Never** commit secrets or print them in logs. Never edit `.env*` files unless asked.

### Server core (where things live)

- `src/server/db/connect.ts`: `connect()` returns the shared Mongoose connection (cached on `globalThis._mongoose`; `bufferCommands` off, `serverSelectionTimeoutMS` 5 s, `maxPoolSize` 10, `autoIndex` only outside production), plus `disconnect()` and `pingDatabase()`.
- `src/server/models/`: one model per file using `models.X ?? model("X", schema, "collectionName")`; register every model in `models/index.ts` so `npm run db:sync-indexes` builds its indexes (production runs with `autoIndex` off: run it before deploying index changes).
- `src/server/http/api-handler.ts`: wrap every route handler in `apiHandler({ body?, query?, params?, cacheControl? }, handler)`. It parses inputs with Zod, maps errors to the envelope (`errors.ts`: ZodError → 422 with `details.fieldErrors`, `AppError` → its status, anything else → 500 with a generic message, logged), sets `x-request-id`, sets `Cache-Control: no-store` unless `cacheControl` is given, and calls `connection()` first so the handler never runs during `next build` prerendering. Build responses with `ok()` / `fail()` from `responses.ts`.
- `src/server/http/action-result.ts`: `runAction()` for Server Actions, same codes and messages via `toFailure()`.
- `src/server/http/request.ts`: `getClientIp(headers)` and `assertSameOrigin(request)`; call the latter first in every state-changing route handler (Server Actions have Next's own origin check).
- `src/server/log.ts`: `log.info/warn/error/debug(msg, fields)` writes JSON lines with secrets redacted and emails/phones masked. Use it instead of `console.*` on the server.
- `src/server/security/rate-limit.ts`: `consumeRateLimit(key, { limit, windowSec })` → `{ allowed, remaining, retryAfterSec }`. Fixed window in the `rateLimits` collection (hashed keys, TTL). When denying, throw `AppError("RATE_LIMITED", msg, 429, { retryAfterSec })`; `apiHandler` adds `Retry-After`.
- `GET /api/v1/health` → `{ status, db }`, 503 when the database is down.
- Security headers (nosniff, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy, HSTS outside dev) are set in `next.config.ts`; CSP is batch 8.2. Keep `geolocation=(self)` (city picker) and don't restrict autoplay/fullscreen (YouTube trailers).

## 7. Architecture Notes

- **Pattern:** Layered, feature-grouped. UI (Server Components first) → Route Handler / Server Action → Service → Mongoose Model → MongoDB.
- **Rendering:** Server Components by default. Add `"use client"` only for interactive pieces (seat map, filters, carousels, forms, modals). Public listing/detail pages are cacheable; booking and admin pages are dynamic.
- **API style:** REST, JSON, base path `/api/v1`.
  - `/api/v1/auth/*` — `POST customer/otp/request`, `POST customer/otp/verify`, `POST admin/login`, `POST refresh`, `POST logout`, `GET me`.
  - `/api/v1/public/*` — catalogue reads (movies, events, venues, shows, offers, cities), search, seat availability, seat holds, orders, payment initiation, my bookings, wishlist, reviews, leads (list-your-show, corporate, contact).
  - `/api/v1/admin/*` — CRUD for every admin resource, reports/CSV export, check-in (`PATCH bookings/:id/check-in`), refunds, settlements, settings, backup.
  - `/api/v1/webhooks/*` — payment gateway callbacks.
  - Response envelope: `{ success: true, data, meta? }` or `{ success: false, error: { code, message, details? } }`. Lists use `?page=&limit=&sort=&q=` and return `meta: { page, limit, total }`.
- **Error handling:** throw `AppError(code, message, status, details?)` from services. A shared `apiHandler()` wrapper catches errors, maps `ZodError` → 422 with field errors, `AppError` → its status, anything else → 500 (logged, generic message to client).
- **Validation:** Zod on every boundary: request body, query, params, Server Action input, form (client + server), env. Mongoose schemas mirror Zod for persistence rules (required, enums, indexes) but Zod is authoritative for input.
- **Auth flow:**
  - **Built (batch 1.3):** `src/server/auth/jwt.ts` (jose HS256, iss `showbuzz`, aud `showbuzz-public`, `typ` access|refresh, 5 s clock tolerance; returns `{ ok, claims } | { ok: false, reason }`, no DB import so `proxy.ts` can use it), `session.ts` (`createSession`, `rotateSession`, `revokeSession`, `revokeAllSessions`: sessions live in `users.sessions[]` with sha256 refresh-token hashes and the current `refreshJti`; rotation is conditional on the old hash; the previous token within 10 s gets the current pair re-signed deterministically, after that it revokes the session and logs `auth.refresh_reuse`; refresh expiry slides 7 days per rotation; max 10 sessions, least recently used evicted) and `cookies.ts` (`setSessionCookies` / `clearSessionCookies` / `readAccessToken` / `readRefreshToken` for `cookies()` or `NextResponse.cookies`; names `sb_at`/`sb_rt` in dev, `__Host-sb_at`/`__Secure-sb_rt` in production; refresh cookie path `/api/v1/auth`, so Server Actions never receive it and refresh must go through that route). Wired to routes in batch 1.4; UI in 1.6.
  - **Built (batch 1.4):** route handlers under `src/app/api/v1/auth/` (`customer/otp/request`, `customer/otp/verify`, `refresh` POST + GET?next=, `logout`, `me`), all thin over `src/server/auth/customer-auth.service.ts` (`signInWithOtp`, `refreshCustomerSession`, `currentCustomer`, `signOut`). State-changing POSTs call `assertSameOrigin`; GET refresh answers 303 to `safeNextPath(next)` (`src/lib/safe-next.ts`) or to `/?auth=signin&next=` with cleared cookies. `currentCustomer` checks the session still exists, so logout takes effect before the access token expires. Server Actions in `src/app/(public)/_actions/auth.ts` mirror request/verify/logout (no refresh action: the refresh cookie never reaches them). Route handlers read cookies with `readRequestCookies(request)` (don't wrap the Request in NextRequest: it consumes the body) and set them on the `NextResponse` from `ok()`; `apiHandler`'s `onFailure` hook can adjust error responses (refresh clears cookies on 401). Endpoints are documented in `docs/openapi.yaml`; keep it in sync.
  - **Customers:** phone/email + OTP (prototype demo OTP `1234` must not exist in production). On verify, issue an access JWT (15 min) and refresh JWT (7 days) as `httpOnly`, `Secure`, `SameSite=Lax` cookies. Refresh tokens are rotated on every use and stored hashed on the user document so they can be revoked.
  - **Admin staff:** email + password (bcrypt). Separate cookies and a different JWT `aud` (`showbuzz-admin` vs `showbuzz-public`), so a customer token can never open the admin console.
  - `src/proxy.ts` does a fast token check and redirects unauthenticated users (`/admin/**` → `/admin/login` in Phase 5, `/account/**` → sign-in). This is **not** the security boundary: every admin route handler and Server Action re-verifies the token and checks permissions server-side.
  - **Built (batch 1.5):** `src/proxy.ts` runs only for `/account/:path*` (matcher skips Link prefetches via `missing` on `next-router-prefetch`/`purpose: prefetch`, because Next strips those headers before proxy code runs). The decision lives in `decideCustomerRoute()` (`src/server/auth/route-guard.ts`, JWT only, no DB): GET/HEAD without a valid customer access token → `/api/v1/auth/refresh?next=<path+search>`; other methods (Server Actions post to the page URL) pass through. Server-side guards in `src/server/auth/current-customer.ts`: `getCurrentCustomer()` (React `cache()`, reads `cookies()`, checks user active + session live), `requireCustomer()` (401 for actions/route handlers) and `requireCustomerPage(path)` (redirects through the refresh route). Protected pages call `requireCustomerPage` inside an async child wrapped in `<Suspense>` (Cache Components), e.g. `src/app/(public)/(site)/account/profile/page.tsx`. Tests fake `next/headers` cookies with `vi.mock`.
  - **RBAC:** roles from the prototype matrix: Super Admin, Cinema Manager, Event Manager, Finance, Support. Permissions are `resource:action` strings (e.g. `movies:write`, `refunds:approve`) checked with `requirePermission()` in `src/server/auth/rbac.ts`. Roles are editable data (`/admin/roles`), not hard-coded checks.
- **Domain model (MongoDB collections):** `users` (customers), `staff`, `roles`, `cities`, `languages`, `genres`, `movies`, `events` (one collection with `kind: concert | comedy | play | sport | activity | stream ...`), `venues` (cinemas, stadiums, grounds), `screens`, `seatLayouts`, `shows`, `seatHolds`, `bookings`, `payments`, `refunds`, `organisers`, `settlements`, `showSubmissions` (list-your-show), `offers`, `coupons`, `giftCards`, `foodItems`, `banners`, `reviews`, `notifications`, `pages`, `seoMeta`, `mediaAssets`, `activityLogs`, `settings` (single document), `leads` (corporate/contact).
  - Built so far (models in `src/server/models/`, Zod in `src/schemas/user.ts`):
    - `users`: customers. `phone` (E.164 `+91XXXXXXXXXX`) and/or `email` (lowercase), each with a unique partial index (only documents that have the field), at least one required unless `status: "deleted"`. `status` active | blocked | deleted. `sessions[]` holds one entry per signed-in device (`sid`, refresh-token hashes, expiry, user agent, IP /24 or /48 prefix only). `toJSON`/`toObject` drop `sessions` and every `*Hash` field; `user.toCustomerSnapshot()` → `{ id, name, email?, phone?, joinedAt }` is the only user shape sent to the browser.
    - `otpChallenges`: one OTP each (`channel` sms | email, normalised `identifier`, `purpose` sign_in | change_contact, `userId` for contact changes, `pendingName`, `codeHash` (HMAC, never the code), `attempts`/`maxAttempts`, `consumedAt`, `ipPrefix`). TTL on `expiresAt`; index `{ identifier, purpose, createdAt: -1 }`.
    - `rateLimits`: fixed-window counters (`key` = SHA-256 of the limiter key, `windowStart`, `count`), unique `{ key, windowStart }`, TTL on `expiresAt`.
  - Identifiers are normalised by `toE164IndianPhone()` / `makeEmailSchema()` in `src/schemas/common.ts` (used by sign-in, profile, checkout contact and lead forms) and parsed by `contactIdentifierSchema` into `{ channel: "sms", phone } | { channel: "email", email }`. Auth limits live in `AUTH` in `src/config/constants.ts`. Store IPs only as `ipPrefix()` from `src/server/http/request.ts`.
- **Booking & seat-locking rules:**
  - Selecting seats creates documents in `seatHolds` with a unique index on `{ showId, seatId }` and a TTL index on `expiresAt` (hold = `bookingTimeoutMinutes`, default 10). The unique index is what prevents double-booking; never check-then-insert.
  - Confirming payment converts holds into a booking inside a MongoDB transaction. Payment success is trusted only from a verified gateway webhook/signature, never from the client.
  - Ticket QR payload = booking ID + show + seats, signed with HMAC-SHA256 (`QR_SIGNING_SECRET`). `/admin/scan-qr` verifies the signature and marks check-in once (idempotent).
- **Pricing rules** (live in `settings`, defaults from the prototype): GST 18%, convenience fee 8.5% (or flat ₹30, per settings), max tickets per order from settings, cancellation cutoff from settings, nominal cancellation fee ₹50. Seat zones: Recliner, Executive, Premium, Regular, VIP, Wheelchair; seats can be blocked. Coupon rules: percentage or flat, `maxDiscount`, `minOrder`, validity, usage limits (e.g. `SHOW50` = 50% up to ₹150, min order ₹300). All pricing is computed server-side in `pricing.service.ts`; the client total is display-only.
- **Money & dates:** store money as integer **paise** (₹1 = 100), format at the edge with `lib/money.ts`. Store dates in UTC (`Date`), display in `Asia/Kolkata`. Show times are stored as full UTC datetimes, not "06:15 PM" strings.
- **IDs & slugs:** MongoDB `_id` internally; human-readable codes for display (`bookingCode` like `SB-883921`). Public URLs use slugs (`/movies/chrono-nexus-origins`), unique per collection.
- **Design systems:** two themes in one Tailwind config.
  - Public: primary `#FF385C` (hover `#E00B41`), secondary `#2563EB`, accent `#8B5CF6`, surface `#F8FAFC`, border `#E2E8F0`, text `#0F172A` / `#64748B`; font Plus Jakarta Sans; light theme, glass header, mobile bottom nav.
  - Admin: indigo `#4F46E5`, dark `#312E81`, coral `#F15B6C`, teal `#168AAD`, status success `#16A66A` / warning `#F5A524` / danger `#DC3545`, surface `#F5F7FB`, border `#E3E8EF`, text `#172033` / `#667085` / `#98A2B3`; font Inter; shadows `card`, `dropdown`, `modal` (see `showBuzz_HTML/admin/tailwind.config.js`).
  - Load fonts with `next/font/google`. Define tokens with `@theme` in `globals.css` (e.g. `--color-public-primary`, `--color-admin-indigo`).

## 8. Code Style & Conventions

- Follow existing patterns in neighboring files before introducing new ones.
- **Naming:** route folders and non-component files `kebab-case` (`seat-hold.service.ts`); React component files and components `PascalCase` (`SeatMap.tsx`); Mongoose model files `PascalCase` singular (`Booking.ts`); functions/variables `camelCase`; constants `UPPER_SNAKE_CASE`; Zod schemas `camelCase` + `Schema` suffix (`createMovieSchema`), inferred types `PascalCase` (`CreateMovieInput`).
- **Formatting:** Prettier with `prettier-plugin-tailwindcss` (sorts classes). Do not hand-format.
- **Imports:** use the `@/` alias (`@/server/services/booking.service`), never deep relative paths across areas. Public code must not import from `components/admin` and vice versa; shared code goes in `components/ui`.
- **Server/client boundary:** anything under `src/server/` starts with `import "server-only"`. Never import models or services into a `"use client"` file.
- **Types:** strict mode, `noUncheckedIndexedAccess`; no `any` (use `unknown` + narrowing / Zod parsing). Next 16 `params`, `searchParams`, `cookies()` and `headers()` are async: always `await` them.
- **Components:** Server Components by default; small client islands. Props typed with explicit interfaces. Use `next/image` (with `images.remotePatterns` in `next.config.ts`) and `next/link`.
- **Styling:** Tailwind utility classes; extract repeated patterns into components, not `@apply` soup. No inline `style` except dynamic values (e.g. seat grid positions).
- **Comments:** explain _why_, not _what_. No commented-out code.
- **Functions:** small and single-purpose; early returns.

## 9. Testing Guidelines

- Every new feature or bug fix needs tests.
- Unit tests (`tests/unit/`): services, pricing, coupon logic, Zod schemas, utils.
- Integration tests (`tests/integration/`): route handlers and models against `mongodb-memory-server` (replica-set mode for transaction tests).
- E2E (`tests/e2e/`): Playwright for the full booking journey (city → movie → showtime → seats → food → checkout → payment → ticket) and admin login + one CRUD flow per resource type.
- Must-have cases: concurrent seat holds on the same seat (only one wins), hold expiry, coupon min-order/max-discount, cancellation cutoff and refund amount, RBAC denial (403), customer token rejected on admin routes, webhook signature failure.
- Mock external services (payment gateway, OTP provider, media storage); never hit real APIs or production data.
- Name tests by behavior: `it("returns 409 when the seat is already held")`.

## 10. Git & Workflow

- **Branches:** work directly on `main` (decided 2026-10-12, build phase). Don't create feature/fix/chore branches, even if a batch prompt suggests one.
- **Claude never commits or pushes.** Leave changes uncommitted on `main` and end with a suggested Conventional Commit message; the user reviews and commits manually. No `Co-Authored-By` trailers.
- **Commits:** Conventional Commits, e.g. `feat(booking): add seat hold TTL`, `fix(admin): correct settlement commission`.
- `main` deploys to production on Vercel, so every commit there must pass lint, typecheck, tests and build first.
- Make small, focused commits. Do not push or force-push unless asked.

## 11. Rules for Claude

**Do**

- Read relevant files before editing; match existing style.
- When building a page, open the matching prototype file in `showBuzz_HTML/` first and reproduce its layout, content and interactions with real data.
- Make the smallest change that solves the problem.
- Validate every input with Zod and compute prices/totals on the server.
- Explain non-obvious decisions briefly.
- Ask when requirements are ambiguous instead of guessing (see §12 for known open questions).
- Update docs, types, schemas and tests alongside code changes.

**Don't**

- Don't refactor unrelated code or rename things without being asked.
- Don't modify: `showBuzz_HTML/` (reference only), `package-lock.json` by hand, `.env*` files, generated `.next/` output.
- Don't install packages, change config, or alter CI/Vercel settings without confirmation.
- Don't delete files or run destructive commands (`rm -rf`, `db.dropDatabase()`, `deleteMany({})`, `git reset --hard`) without confirmation.
- Don't expose secrets or user data; never log tokens, OTPs, passwords or card data. (One agreed, temporary exception: `LogOtpSender` logs sign-in codes while no OTP provider exists; see §12.)
- Don't port prototype shortcuts to production: demo OTP `1234`, demo admin `admin@showpilot.test / Admin@123`, localStorage as a database, client-side payment "success", card storage in the browser.
- Don't use `localStorage` for anything security-relevant; it is fine only for UI preferences (e.g. last city).

## 12. Known Issues & Gotchas

- **Inconsistent prototype rules — confirm before implementing:**
  - Ticket limit: public seat page enforces 8 seats; admin settings say `maxTicketsPerOrder: 10`.
  - Cancellation: public cinema data says "up to 20 mins before show"; admin settings say `cancellationPolicyHours: 4`.
  - Coupon codes differ between public (`SHOW50`, `UPIFIRST`, `HDFCWEEKEND`, `COMBOFREE`, `GOLDVIP`) and admin (`SHOWPILOT50`, `KOLKATAROCKS`).
  - Prototype datasets disagree (e.g. `shows.json` movie titles don't match `movies.json`; public and admin use different movie catalogues). The seed script must normalise them.
  - Public city list has 10 popular + 22 other cities; admin mentions Kolkata, Mumbai, Bengaluru only.
- **Next.js 16:** middleware is now `src/proxy.ts`; `next lint` is gone (use ESLint CLI); request APIs are async; Turbopack is the default bundler.
- **Tailwind v4:** no `tailwind.config.js`. Port the prototype tokens into `@theme` in `globals.css`. Class names like `bg-brand-indigo` keep working if the token is named `--color-brand-indigo`.
- **TypeScript 7** is the new native (Go) compiler. If an editor plugin or tool breaks on it, pin TypeScript 6.x temporarily and note it here.
- **Mongoose on Vercel:** reuse one cached connection (`globalThis._mongoose`) to avoid exhausting Atlas connections; define models as `models.Movie || model("Movie", schema)` to survive hot reload. Mongoose must not run in the Edge runtime (only Node runtime route handlers).
- **Transactions** need a replica set: Atlas works; local plain `mongod` does not (use Atlas dev cluster or `mongodb-memory-server` replica set).
- **Remote images:** prototype uses Unsplash URLs; add `images.unsplash.com` to `images.remotePatterns` until real media storage is in place.
- **Timezone:** all dates stored in UTC, displayed in IST. Never parse prototype display strings like `"Sun, 23 Aug 2026"` as dates.
- **Undecided:** payment gateway (Razorpay vs Cashfree), OTP provider, media storage, rich-text editor, email provider.
- **Installed vs target versions:** the repo currently has TypeScript 5.x and ESLint 9 (§2 lists the targets); `@types/node` is on 24 (Vitest 5 requires ≥22). Vitest 5 runs on Vite 8, so `vite` and `@testing-library/dom` are explicit dev dependencies. Tailwind runs through the `@tailwindcss/turbopack` loader in `next.config.ts`, not `@tailwindcss/postcss`.
- **Cache Components is on** (`cacheComponents` + `partialPrefetching`). Anything reading `searchParams`, `cookies()`, `headers()` or the current time must sit inside `<Suspense>` (call `connection()` before `new Date()`). Client libraries that read the clock while rendering (e.g. Swiper) must mount after hydration (`useMounted`). `next build` enforces this.
- **Route types:** `PageProps<"/route">` types come from `next typegen`; `npm run typecheck` runs it first.
- **`server-only`** is resolved by Next's internal alias (no npm package installed). Vitest aliases it to `tests/stubs/server-only.ts`; scripts run through `tsx --tsconfig tsconfig.scripts.json`, which maps it to the same stub.
- **`connection()` outside Next** throws ("called outside a request scope"). Tests that call route handlers directly get a no-op stub from `tests/setup/next-request.ts` (unit and integration projects).
- **Line endings:** `.gitattributes` forces LF (Prettier's default) even with `core.autocrlf=true` on Windows. Formatting is Prettier (`printWidth` 120, Tailwind class sorting incl. `cn()`/`clsx()`); don't hand-format.
- **Integration tests** get `MONGODB_URI`/`MONGODB_DB` from the in-memory replica set (`tests/integration/setup.ts`), which refuses any non-local URI, so `.env.local` is never used by tests. Test files run one at a time and share one server: clean up what you create.
- **`AGENTS.md`** is (re)generated by `next dev`; commit it or it keeps reappearing.
- **Phase 1 stand-ins (public UI on seed data):** catalogue in `src/server/data/seed-catalog.ts`; bookings, reviews and leads are kept in memory by their services. Payment is simulated only when `NODE_ENV !== "production"` (`isDemoMode` in `src/config/env.ts`).
- **OTP sign-in is on MongoDB** (`src/server/auth/otp.ts`: `otpChallenges`, rate limits, atomic attempts and single use, find-or-create user). No SMS/email provider yet: with `OTP_PROVIDER=none` (default) `LogOtpSender` writes each code to the server log (Vercel logs) in every environment, and outside production the code is also returned as `devCode` for on-screen display. This is a temporary, agreed exception to "never log OTPs"; remove it when a provider is added (`src/server/auth/otp-delivery.ts`). The verify action still returns a customer snapshot to the client store until sessions land (batch 1.3). Account pages are protected by `proxy.ts` + `requireCustomerPage()`; `AccountGate` remains as a client gate (fed from the server snapshot when the tab's store is empty) until batch 1.6. The sign-in modal does not open from `?auth=signin&next=` yet (1.6).

## 13. Useful References

- Prototype (public): `showBuzz_HTML/README.md`
- Prototype (admin): `showBuzz_HTML/admin/README.md`
- Next.js docs: https://nextjs.org/docs
- Mongoose docs: https://mongoosejs.com/docs/
- Zod docs: https://zod.dev
- Tailwind CSS v4 docs: https://tailwindcss.com/docs
- Zustand docs: https://zustand.docs.pmnd.rs
- jose: https://github.com/panva/jose
- Vercel docs: https://vercel.com/docs
- Design / Figma: <link — not yet provided>
- API spec: `docs/openapi.yaml` (OpenAPI 3.1; update it with every endpoint change)
- Issue tracker: <link — not yet provided>
