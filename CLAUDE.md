# CLAUDE.md

> Project instructions for Claude Code. Keep this file accurate: outdated info is worse than none.
> Last reviewed: 2026-10-14 (partner portal, console kit, partner venues and seat layouts, partner movies/events/shows). Library versions below are the latest stable releases on npm as of 2026-10-10; installed versions are pinned in the pnpm catalog (`pnpm-workspace.yaml`).

## 1. Project Overview

- **Name:** ShowBuzz (repo/folder: `showBuzz`)
- **Purpose:** A multi-city entertainment discovery and ticket-booking platform (in the style of BookMyShow) for movies, live events, plays, sports, activities and streaming, with a full back-office console for operators, cinema managers, event organisers and finance staff.
- **Type:** Full-stack web app in a pnpm + Turborepo monorepo. `apps/web` is the public site + its REST API (showbuzz.com); `apps/admin` is the super-admin console (admin.showbuzz.com); `apps/partner` is the vendor portal (partner.showbuzz.com). Shared code lives in `packages/*`.
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
| Package manager | pnpm (workspaces + catalog), pinned via `packageManager`                              | 12.11.x                                                         |
| Monorepo tasks  | Turborepo                                                                             | 2.11.x                                                          |
| Hosting / CI    | Vercel (one project per app; preview per PR, production on `main`)                    | —                                                               |

**State management decision:** Zustand is the client-state library. Redux Toolkit (2.13.x) is _not_ used; do not add it unless explicitly agreed. Server data is fetched in Server Components; Zustand holds only client/UI state (selected city, seat selection, cart, auth snapshot, UI toggles).

**Package manager decision (2026-10-13):** pnpm, in a monorepo run by Turborepo. Commit only `pnpm-lock.yaml` (never `package-lock.json` / `yarn.lock`, never edit the lockfile by hand). Versions shared by apps and packages live once in the `catalog:` of `pnpm-workspace.yaml`; workspace packages depend on each other with `workspace:*`.

## 3. Key Libraries

- `next`: App Router, Server Components, Route Handlers, `proxy.ts` (Next 16 replacement for `middleware.ts`).
- `mongoose`: all DB access goes through models in `packages/db/src/models/`. No raw driver calls outside `packages/db/src/`.
- `zod`: single source of truth for input shapes. Every API body, query string, route param, form and env var is validated with a Zod schema from `packages/schemas/src/`. Infer TS types with `z.infer`, don't hand-write duplicates.
- `jose`: sign/verify JWTs (works in both Node and Edge runtimes, so it can run inside `proxy.ts`). Do not use `jsonwebtoken`.
- `bcryptjs`: hash admin/staff passwords (cost 12).
- `zustand`: client stores in `apps/web/src/stores/`. Use `useShallow` for multi-field selectors.
- `react-hook-form` + `@hookform/resolvers/zod`: all non-trivial forms (admin CRUD forms, checkout, profile).
- `tailwindcss` v4: theme tokens live in CSS (`@theme`) in `apps/web/src/app/globals.css`, not in `tailwind.config.js`.
- `lucide-react`: icon set for **both** public and admin (replaces FontAwesome and Lucide CDN from the prototype).
- `qrcode` (1.5.x, in `@showbuzz/core` only): M-ticket QR as SVG, rendered on the server (`packages/core/src/booking/ticket-qr.ts`). Added 2026-10-13.

Candidate libraries for prototype features (ask before installing):

- `swiper` (14.x): public hero/carousels.
- `chart.js` + `react-chartjs-2`: admin dashboard/analytics charts.
- `@dnd-kit/core`: drag-and-drop ordering (banners, seat layout designer).
- `sonner`: toast notifications.
- Rich text editor for CMS pages (prototype used Quill): choose one with the team.
- Payment gateway SDK (Razorpay or Cashfree): not decided yet.

**Do not add** new dependencies without asking. Prefer what is already installed.

## 4. Project Structure

pnpm + Turborepo monorepo: **apps** are deployable Next.js apps, **packages** are shared TypeScript source
(no build step; apps compile them via `transpilePackages`). Dependency direction, never reversed:
`schemas → utils → runtime → db → core → apps` (Turbo rejects cycles); the UI packages (`ui`, `console-ui`) depend on `utils` only and are used by apps. Packages never import from `apps/`.

```
showBuzz/
├── apps/
│   ├── web/                              # @showbuzz/web: public site + REST API (showbuzz.com), dev :3000
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (public)/             # Customer site (route group: no URL prefix)
│   │   │   │   │   ├── layout.tsx        # City/auth modals, toaster, store hydration (all public pages)
│   │   │   │   │   ├── _actions/         # Server Actions used by public client islands
│   │   │   │   │   ├── (focus)/booking/[showId]/seats/  # Full-screen seat map (no site header/footer)
│   │   │   │   │   └── (site)/           # Every other public page (header, footer, bottom nav): home, movies/,
│   │   │   │   │                         # cinemas/, events/ plays/ sports/ activities/, stream/ offers/ gift-cards/,
│   │   │   │   │                         # booking/ (food, checkout, payment, success, failure), account/,
│   │   │   │   │                         # list-your-show/ corporate/ contact/ faq/ about/ privacy/ terms/
│   │   │   │   ├── api/v1/               # auth/ (customer OTP, refresh, logout, me), health/; later public/, webhooks/
│   │   │   │   ├── api/internal/revalidate/ # POST, REVALIDATE_SECRET: consoles refresh the catalogue cache
│   │   │   │   ├── globals.css           # Tailwind v4 import + @theme tokens; @source for packages/ui
│   │   │   │   ├── layout.tsx            # Root layout (fonts, metadata)
│   │   │   │   └── not-found.tsx
│   │   │   ├── proxy.ts                  # Route protection for /account/** (Next 16)
│   │   │   ├── components/public/        # Public-only components, grouped by feature (movie/, booking/, seat-map/ ...)
│   │   │   ├── components/ui/Toaster.tsx # Bound to this app's ui store, so not in packages/ui
│   │   │   ├── stores/                   # Zustand stores (city, booking-cart, auth, ui, wishlist)
│   │   │   └── hooks/                    # Client hooks
│   │   ├── tests/{unit,integration,e2e}/ # App tests: components, hooks, route handlers, Server Actions, Playwright
│   │   ├── public/                       # Static assets
│   │   ├── .env.example / .env.local     # This app's env (its Vercel project has its own)
│   │   └── next.config.ts, playwright.config.ts, vitest.config.mts, tsconfig.json, eslint/prettier configs
│   ├── admin/                            # @showbuzz/admin: operations console (admin.showbuzz.com), dev :3001
│   │   ├── src/app/(auth)/               # /login, /forgot-password (no console chrome)
│   │   ├── src/app/(console)/            # Shell layout (menu filtered by permission): dashboard/, profile/, users/,
│   │   │                                 # notifications/, [...section]/ (every other menu page: "Coming soon")
│   │   ├── src/app/api/v1/admin/auth/    # login, refresh (POST + GET bounce), logout, me
│   │   ├── src/app/_actions/             # Server Actions (change own password, Super Admin password reset)
│   │   ├── src/proxy.ts                  # Staff JWT pre-check on every page → refresh bounce → /login?next=
│   │   ├── src/lib/nav.ts                # Console menu (prototype groups) + permission per item
│   │   ├── src/components/               # auth/, profile/, users/ (the shell and kit come from packages/console-ui)
│   │   └── scripts/                      # seed-roles.ts, create-admin.ts (tsx, reads apps/admin/.env.local)
│   └── partner/                          # @showbuzz/partner: vendor portal (partner.showbuzz.com), dev :3002
│       ├── src/app/(auth)/               # /login, /signup (mobile OTP), /forgot-password (stand-in)
│       ├── src/app/(setup)/onboarding/   # Mandatory KYC steps; the only page until onboarding is complete
│       ├── src/app/(console)/            # Shell layout: dashboard/, profile/, venues/ (+ screens, layout designer),
│       │                                 # seat-layouts/ (layouts + live seat manager), movies/, events/ (?kind=),
│       │                                 # shows/ (+ new, bulk, [showId]), [...section]/ ("Coming soon")
│       ├── src/app/api/v1/partner/       # auth/ (login, refresh POST + GET bounce, logout, me), documents/[fileId]
│       ├── src/app/_actions/             # signup, onboarding, password, venues, movies, events, shows
│       ├── src/proxy.ts                  # Vendor JWT pre-check on every page → refresh bounce → /login?next=
│       ├── src/lib/nav.ts                # Portal menu
│       └── scripts/                      # create-vendor-user.ts, seed-demo-vendors.ts (reads apps/partner/.env.local)
├── packages/
│   ├── schemas/   # @showbuzz/schemas: Zod schemas, constants.ts (business constants), types/ (derived types)
│   ├── utils/     # @showbuzz/utils: framework-agnostic helpers (money, dates, cn, safe-next, user-agent, payment, schedule)
│   ├── runtime/   # @showbuzz/runtime: env.ts (server env), public-env.ts (NEXT_PUBLIC_*), log.ts (redacting logger)
│   ├── db/        # @showbuzz/db: connect.ts, models/ (+ index.ts), mongoose.ts (re-exports), shows.ts (show
│   │              #   generator), storage/file-storage.ts (FileStorage, GridFS), scripts/ (seed.ts + seed-data.ts,
│   │              #   sync-indexes.ts). The only package that depends on mongoose.
│   ├── core/      # @showbuzz/core: services/ (+ partner/), http/ (apiHandler, AppError, responses, request,
│   │              #   internal-auth), auth/ (jwt, session, cookies, otp, customer-auth, current-customer,
│   │              #   route-guard, password*, console-route-guard, admin/, partner/), security/rate-limit
│   ├── ui/        # @showbuzz/ui: shared UI primitives (Modal)
│   ├── console-ui/ # @showbuzz/console-ui: back-office kit for admin + partner (ConsoleShell, PageParts, form, fields,
│   │              #   DataTable, FilterBar, ConfirmDialog, StatusBadge, Toaster, nav, search-params, theme.css)
│   └── config/    # @showbuzz/config: tsconfig bases, ESLint flat config, Prettier options, Vitest preset + stubs
├── docs/                                 # roadmap.md, auth.md, openapi.yaml
├── pnpm-workspace.yaml                   # workspaces, catalog (shared versions), allowBuilds
├── turbo.json                            # task graph + declared env vars
├── package.json                          # root scripts → turbo
└── CLAUDE.md
```

Each package lives in `packages/<name>/src` with its tests in `packages/<name>/tests/{unit,integration}`. Packages
export source by path: `@showbuzz/core/http/api-handler`, `@showbuzz/db/models/User`, `@showbuzz/db/models` (index),
`@showbuzz/schemas/constants`, `@showbuzz/schemas/types/booking`, `@showbuzz/utils/money`, `@showbuzz/ui/Modal`.

**Imports**

- Inside an app, `@/*` means that app's own `src/` only. Shared code is always `@showbuzz/<pkg>/...`.
- Inside a package, use relative imports in `src/`; tests import their own package by name. Packages never use `@/`.
- Every package declares in its `package.json` each dependency it imports (pnpm is strict; nothing is hoisted).

**Where things go**

- New public page → `apps/web/src/app/(public)/(site)/<route>/page.tsx`; its components → `apps/web/src/components/public/<feature>/`.
- New admin page → `apps/admin/src/app/...` (from the admin batch on); admin-only components stay in `apps/admin`.
- New partner page → `apps/partner/src/app/(console)/<route>/page.tsx` (guard: `requireVendorPage`); its data access →
  `packages/core/src/services/partner/` (always scoped by the session's vendor id).
- Component used by both consoles → `packages/console-ui/src/` (props only, no app imports). Lists use `DataTable` +
  `FilterBar` with `parseListParams()` from `@showbuzz/console-ui/search-params`.
- New API endpoint → `apps/<app>/src/app/api/v1/{auth|public|admin|webhooks}/<resource>/route.ts`. Keep handlers thin: parse with Zod → call a service → return the response envelope.
- New collection → `packages/db/src/models/<Name>.ts` (register it in `models/index.ts`) + Zod schema in `packages/schemas/src/<name>.ts` + seed data. Add indexes in the model file.
- Business rules → `packages/core/src/services/`, never in components or route handlers.
- Shared types → infer from Zod in `packages/schemas`; only non-schema types go in `packages/schemas/src/types/`.
- Component used by both apps → `packages/ui/src/` (no app stores or app imports; pass data via props).
- Business constants → `packages/schemas/src/constants.ts`. Env → `packages/runtime`. Generic helpers → `packages/utils`.
- Server scripts (seed, create-admin, sync-indexes) → `packages/db/scripts/`, run with tsx through a `db:*` script.

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

Run from the repo root; the root scripts call Turborepo, which runs the task in every workspace that has it
(in dependency order, cached where safe). Target one workspace with `--filter`, e.g. `pnpm --filter @showbuzz/web dev`.

```bash
# Install (Node >= 24; pnpm version comes from "packageManager")
pnpm install

# Development (Turbopack); web on http://localhost:3000, admin on http://localhost:3001, partner on http://localhost:3002
pnpm dev

# Build / start
pnpm build                   # turbo run build (next build in each app)
pnpm --filter @showbuzz/web start

# Lint / format  (Next 16 removed `next lint`; ESLint runs directly in each workspace)
pnpm lint
pnpm format                  # prettier --write in each workspace + root files
pnpm format:check

# Type check
pnpm typecheck               # tsc --noEmit per workspace (web: next typegen first)

# Tests  (Vitest projects per workspace: unit = node, unit-dom = jsdom for *.test.tsx, integration = mongodb-memory-server)
pnpm test                                   # every workspace (fetches mongod once first if missing)
pnpm --filter @showbuzz/core test           # one workspace
pnpm --filter @showbuzz/core exec vitest run tests/unit/services/pricing.test.ts   # one file
pnpm --filter @showbuzz/web test:unit       # unit + unit-dom of the web app
pnpm --filter @showbuzz/web test:integration
pnpm --filter <pkg> test:watch | test:coverage
pnpm test:e2e                # Playwright: next dev on :3100 + in-memory MongoDB (apps/web/tests/e2e/server.ts); Chromium desktop + Pixel 7
pnpm --filter @showbuzz/web exec playwright install chromium   # once per machine, before the first test:e2e

# Database
pnpm db:sync-indexes         # build/drop indexes to match the models (run before deploying index changes)
pnpm db:seed-roles           # create the 5 system roles (idempotent; Super Admin re-synced to every permission)
pnpm db:create-admin --email you@showbuzz.com --name "Your Name"   # first Super Admin; prompts for the password
pnpm db:create-vendor-user --vendor <slug> --email owner@biz.com --name "Owner"   # owner login for an existing vendor
pnpm db:seed-demo-vendors    # dev only: logins for the 3 seeded vendors (screens@ / palace@ / events@showbuzz.test, 12345678)
pnpm db:seed                 # catalogue + settings + shows for the next 7 days (idempotent upserts by slug/code; never deletes)
# Run db:seed before the first `pnpm build` against a new database: the build prerenders catalogue pages from MongoDB.

# Dependencies
pnpm --filter <pkg> add <dep>          # then move the version into the catalog if more than one workspace uses it
```

There are no migrations (MongoDB). Schema changes are handled in Mongoose models; data backfills go in `packages/db/scripts/` as one-off, idempotent scripts.

Always run **lint, typecheck and build** before declaring a task complete. Tests are deferred during the build phase (see §9).

## 6. Environment & Configuration

- Env files live **per app**: `apps/web/.env.example` → copy to `apps/web/.env.local` (Next loads it from the app folder). `apps/admin` gets its own in the admin batch. Each Vercel project has its own variables per environment (Development / Preview / Production). Scripts in `packages/db` read `apps/web/.env.local`.
- Env vars are parsed with Zod in two files in `@showbuzz/runtime`; never read `process.env` anywhere else (exceptions: build tooling and test setup):
  - `packages/runtime/src/env.ts` (`import "server-only"`): server variables, validated when first imported, so a missing or malformed variable fails boot and `next build` (the error names the variable, never its value). Exports `env`, `isProduction`, `isDemoMode`. Add a variable here (and to `.env.example`) when the code that needs it lands.
  - `packages/runtime/src/public-env.ts`: `NEXT_PUBLIC_*` only, safe for client components (`publicEnv.NEXT_PUBLIC_APP_URL`, `publicEnv.appOrigin`). `NEXT_PUBLIC_APP_URL` is required in production and defaults to `http://localhost:3000` otherwise.
- The env is split so each app only needs its own secrets: `env.ts` (every app: `NODE_ENV`, `MONGODB_*`, `VERCEL_*`), `otp-env.ts` (web and partner: `OTP_HASH_SECRET`, `OTP_PROVIDER`; each app may use its own hash secret), `customer-auth-env.ts` (web: the OTP env + `JWT_*`), `admin-auth-env.ts` (admin: `ADMIN_JWT_ACCESS_SECRET` / `ADMIN_JWT_REFRESH_SECRET`, ≥32 chars, must differ), `partner-auth-env.ts` (partner: `PARTNER_JWT_ACCESS_SECRET` / `PARTNER_JWT_REFRESH_SECRET`, same rules), `revalidate-env.ts` (all three: `REVALIDATE_SECRET`, ≥32 chars, **same value in every app**) and `web-app-env.ts` (admin and partner: `WEB_APP_URL`, the public app's origin for server-to-server calls; required in production, defaults to `http://localhost:3000`). Each app's `.env.example` lists its set; `NEXT_PUBLIC_APP_URL` is each app's own origin (`:3001` admin, `:3002` partner locally; `https://admin.showbuzz.com`, `https://partner.showbuzz.com` in production).
- Validated today: `MONGODB_URI`, `MONGODB_DB`, `OTP_HASH_SECRET` (≥32 chars), `OTP_PROVIDER` (optional: `none` default | `dev`, not allowed in production), `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (≥32 chars each, must differ), `NEXT_PUBLIC_APP_URL` (+ Vercel's own `VERCEL_URL` / `VERCEL_BRANCH_URL`, used to accept preview deployment origins), `PAYMENT_PROVIDER` (optional, `simulated` default and only value; allowed in production until a real gateway is chosen, agreed 2026-10-13), `QR_SIGNING_SECRET` (≥32 chars, `ticket-env.ts`), `REVALIDATE_SECRET`, `WEB_APP_URL`, `PARTNER_JWT_*`. `next build` validates them too, so any build environment needs real or placeholder values; tests set their own (see §12).
- Required variables (full list, also in `.env.example`):
  - `MONGODB_URI`: MongoDB Atlas connection string (replica set; needed for transactions).
  - `MONGODB_DB`: database name (e.g. `showbuzz_dev`, `showbuzz_prod`).
  - `JWT_ACCESS_SECRET`: ≥32-byte secret for access tokens.
  - `JWT_REFRESH_SECRET`: ≥32-byte secret for refresh tokens (different from access).
  - `QR_SIGNING_SECRET`: HMAC-SHA256 key for signing ticket QR payloads (≥32 chars, `packages/runtime/src/ticket-env.ts`; the admin app needs the same value for scan-qr). Required by the ticket pages: set it on Vercel.
  - `NEXT_PUBLIC_APP_URL`: canonical site URL (used for cookies, links, SEO).
  - `REVALIDATE_SECRET`: shared by web, admin and partner; authorises `POST /api/internal/revalidate` on web.
  - `WEB_APP_URL` (admin, partner): the public app's origin for that call (`https://showbuzz.com`).
  - `PARTNER_JWT_ACCESS_SECRET`, `PARTNER_JWT_REFRESH_SECRET` (partner): vendor-user tokens.
  - `PAYMENT_KEY_ID`, `PAYMENT_KEY_SECRET`, `PAYMENT_WEBHOOK_SECRET`: payment gateway credentials (gateway TBD: Razorpay or Cashfree).
  - `OTP_HASH_SECRET`: HMAC key for OTP codes at rest.
  - `OTP_PROVIDER` + `OTP_PROVIDER_*`: SMS/email OTP delivery (provider TBD; until then `none` logs the code, see §12).
  - `MEDIA_STORAGE_*`: image/media storage credentials (provider TBD; KYC files use GridFS until then, see §12).
- Only variables prefixed `NEXT_PUBLIC_` reach the browser. Never put secrets in them.
- **Never** commit secrets or print them in logs. Never edit `.env*` files unless asked.

### Server core (where things live)

- `packages/db/src/connect.ts`: `connect()` returns the shared Mongoose connection (cached on `globalThis._mongoose`; `bufferCommands` off, `serverSelectionTimeoutMS` 5 s, `maxPoolSize` 10, `autoIndex` only outside production), plus `disconnect()` and `pingDatabase()`.
- `packages/db/src/models/`: one model per file using `models.X ?? model("X", schema, "collectionName")`; register every model in `models/index.ts` so `pnpm db:sync-indexes` builds its indexes (production runs with `autoIndex` off: run it before deploying index changes).
- `packages/core/src/http/api-handler.ts`: wrap every route handler in `apiHandler({ body?, query?, params?, cacheControl? }, handler)`. It parses inputs with Zod, maps errors to the envelope (`errors.ts`: ZodError → 422 with `details.fieldErrors`, `AppError` → its status, anything else → 500 with a generic message, logged), sets `x-request-id`, sets `Cache-Control: no-store` unless `cacheControl` is given, and calls `connection()` first so the handler never runs during `next build` prerendering. Build responses with `ok()` / `fail()` from `responses.ts`.
- `packages/core/src/http/action-result.ts`: `runAction()` for Server Actions, same codes and messages via `toFailure()`.
- `packages/core/src/http/request.ts`: `getClientIp(headers)` and `assertSameOrigin(request)`; call the latter first in every state-changing route handler (Server Actions have Next's own origin check).
- `packages/runtime/src/log.ts`: `log.info/warn/error/debug(msg, fields)` writes JSON lines with secrets redacted and emails/phones masked. Use it instead of `console.*` on the server.
- `packages/core/src/security/rate-limit.ts`: `consumeRateLimit(key, { limit, windowSec })` → `{ allowed, remaining, retryAfterSec }`. Fixed window in the `rateLimits` collection (hashed keys, TTL). When denying, throw `AppError("RATE_LIMITED", msg, 429, { retryAfterSec })`; `apiHandler` adds `Retry-After`.
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
  - **Built (batch 1.3):** `packages/core/src/auth/jwt.ts` (jose HS256, iss `showbuzz`, aud `showbuzz-public`, `typ` access|refresh, 5 s clock tolerance; returns `{ ok, claims } | { ok: false, reason }`, no DB import so `proxy.ts` can use it), `session.ts` (`createSession`, `rotateSession`, `revokeSession`, `revokeAllSessions`: sessions live in `users.sessions[]` with sha256 refresh-token hashes and the current `refreshJti`; rotation is conditional on the old hash; the previous token within 10 s gets the current pair re-signed deterministically, after that it revokes the session and logs `auth.refresh_reuse`; refresh expiry slides 7 days per rotation; max 10 sessions, least recently used evicted) and `cookies.ts` (`setSessionCookies` / `clearSessionCookies` / `readAccessToken` / `readRefreshToken` for `cookies()` or `NextResponse.cookies`; names `sb_at`/`sb_rt` in dev, `__Host-sb_at`/`__Secure-sb_rt` in production; refresh cookie path `/api/v1/auth`, so Server Actions never receive it and refresh must go through that route). Wired to routes in batch 1.4; UI in 1.6.
  - **Built (batch 1.4):** route handlers under `apps/web/src/app/api/v1/auth/` (`customer/otp/request`, `customer/otp/verify`, `refresh` POST + GET?next=, `logout`, `me`), all thin over `packages/core/src/auth/customer-auth.service.ts` (`signInWithOtp`, `refreshCustomerSession`, `currentCustomer`, `signOut`). State-changing POSTs call `assertSameOrigin`; GET refresh answers 303 to `safeNextPath(next)` (`packages/utils/src/safe-next.ts`) or to `/?auth=signin&next=` with cleared cookies. `currentCustomer` checks the session still exists, so logout takes effect before the access token expires. Server Actions in `apps/web/src/app/(public)/_actions/auth.ts` mirror request/verify/logout (no refresh action: the refresh cookie never reaches them). Route handlers read cookies with `readRequestCookies(request)` (don't wrap the Request in NextRequest: it consumes the body) and set them on the `NextResponse` from `ok()`; `apiHandler`'s `onFailure` hook can adjust error responses (refresh clears cookies on 401). Endpoints are documented in `docs/openapi.yaml`; keep it in sync.
  - **Customers:** phone/email + OTP (prototype demo OTP `1234` must not exist in production). On verify, issue an access JWT (15 min) and refresh JWT (7 days) as `httpOnly`, `Secure`, `SameSite=Lax` cookies. Refresh tokens are rotated on every use and stored hashed on the user document so they can be revoked.
  - **Admin staff (built, batch M.2 = 5.1/5.2/5.4):** email + password (bcryptjs, cost 12, new passwords 12 chars to 72 bytes). Core was generalised, not copied: `auth/token-codec.ts` (`createTokenCodec`; customer `jwt.ts` and `admin/tokens.ts` are instances: aud `showbuzz-admin`, `ADMIN_JWT_*` keys), `auth/session-cookies.ts` (`createSessionCookies`; admin cookies `sba_at` / `sba_rt` (path `/api/v1/admin/auth`) / `sba_has_session`, `__Host-`/`__Secure-` in production, host-only), `auth/session-store.ts` (`createSessionStore` over any model with `sessions[]`; `session.ts` = users, `admin/sessions.ts` = staff, same rotation/reuse rules, max 5 staff devices). `admin/staff-auth.service.ts`: `signInStaff` (one "Invalid email or password." for unknown email, wrong password and disabled account; dummy bcrypt compare for unknown emails; limits 5/15 min per email, 20/15 min per IP), `refreshStaffSession`, `currentStaff` (role read per request, so permission changes apply at once), `signOutStaff`. `admin/current-staff.ts`: `getCurrentStaff()`, `requireStaff()` (401), `requirePermission("x:y")` (403 `FORBIDDEN`), `requireStaffPage(path)` (redirect via refresh). `admin/route-guard.ts`: `decideStaffRoute()` for `apps/admin/src/proxy.ts` (open: /login, /forgot-password, /robots.txt, /api/*; other GET pages need a valid staff access token). `admin/staff-account.service.ts`: `changeOwnPassword` (current password required, other devices signed out), `resetStaffPassword` (Super Admin stand-in, see §12), `seedSystemRoles`, `createStaff`. A customer token fails admin verification (audience and keys differ), and customer cookies are never read by admin code.
  - `apps/web/src/proxy.ts` does a fast token check and redirects unauthenticated users (`/account/**` → sign-in; the admin app has its own `apps/admin/src/proxy.ts` → `/login`). This is **not** the security boundary: every admin route handler and Server Action re-verifies the token and checks permissions server-side.
  - **Built (batch 1.5):** `apps/web/src/proxy.ts` runs only for `/account/:path*` (matcher skips Link prefetches via `missing` on `next-router-prefetch`/`purpose: prefetch`, because Next strips those headers before proxy code runs). The decision lives in `decideCustomerRoute()` (`packages/core/src/auth/route-guard.ts`, JWT only, no DB): GET/HEAD without a valid customer access token → `/api/v1/auth/refresh?next=<path+search>`; other methods (Server Actions post to the page URL) pass through. Server-side guards in `packages/core/src/auth/current-customer.ts`: `getCurrentCustomer()` (React `cache()`, reads `cookies()`, checks user active + session live), `requireCustomer()` (401 for actions/route handlers) and `requireCustomerPage(path)` (redirects through the refresh route). Protected pages call `requireCustomerPage` inside an async child wrapped in `<Suspense>` (Cache Components), e.g. `apps/web/src/app/(public)/(site)/account/profile/page.tsx`. Tests fake `next/headers` cookies with `vi.mock`.
  - **Built (batch 1.6):** the client auth store (`apps/web/src/stores/auth.ts`, not persisted: `status` unknown|authenticated|anonymous, `user`, `accessExpiresAt`, `setSession`, `clearSession`) is filled on page load by `SessionBootstrap` (server, `getCurrentSession()`, in `<Suspense fallback={null}>` in `apps/web/src/app/(public)/layout.tsx`) → `SessionInitializer` (client); no `/me` call. While `status` is unknown the header/drawer show a skeleton, never "Sign In". A third cookie `sb_has_session` (`__Host-` in production, value `1`, path `/`, refresh lifetime) tells the server a session exists, so an expired access token yields `mightRefresh` and one silent `POST /api/v1/auth/refresh`; anonymous visitors make no refresh call. `apps/web/src/hooks/use-session-keep-alive.ts`: `refreshSession()` (single-flight; 401 clears the store), `useSessionKeepAlive()` (60 s before expiry and on focus/visibility), `withAuthRetry(fn)` for auth-required actions. `AuthDeepLink` (Suspense, `useSearchParams`) opens the modal from `?auth=signin&next=` (via `openAuthModal(next)`), then strips those params. AuthModal: resend countdown, expiry hint, auto-submit at 6 digits, `role="alert"` live region, then `router.replace(next)` or `router.refresh()`. Sign-out everywhere goes through `useSignOut()` → `POST /api/v1/auth/logout` (only that path can revoke with the refresh cookie). `AccountGate` is gone; account pages pass the server-checked customer as props. A protected page that fails `requireCustomerPage` after streaming started answers 200 with a client-side `NEXT_REDIRECT` (no content rendered).
  - **Built (batch 1.7):** account management in `packages/core/src/services/account.service.ts` behind Server Actions in `apps/web/src/app/(public)/_actions/account.ts`; every action starts with `requireCustomerSession()` (customer + current `sid`, session checked live in the DB). Profile page loads `getAccountProfile()` (snapshot, verified flags, sessions with device label from `packages/utils/src/user-agent.ts`) and passes it as props. Name is the only directly editable field (the prototype profile has only name/email/phone). Email/phone change only after verifying a code sent to the new identifier (`purpose: "change_contact"`, bound to `userId`; an identifier owned by another account → 409 `CONFLICT` with a neutral message, checked before sending and again via the unique index on confirm); the last identifier can't be removed (atomic guard). Sessions: list, revoke one (revoking this device clears cookies = sign-out), sign out all other devices. Account deletion (decided 2026-10-13: anonymise): fresh `delete_account` code, then `status: "deleted"`, name `"Deleted user"`, `deletedAt`, phone/email/verified dates unset, all sessions revoked; the document and `_id` stay so bookings/payments keep their link for GST; the old phone/email can sign up afresh. The OTP service exposes `issueChallenge()` / `consumeChallenge()` for any purpose (same limits; a code for another purpose or user is rejected as expired).
  - **Built (batch 1.9):** full write-up in `docs/auth.md` (flows, cookies, claims, rate limits, threat model, provider guide, production checklist). Step-up: `startContactChange` / `removeContact` need this session to be created or re-confirmed within `AUTH.stepUpWindowSec` (10 min), else `403 STEP_UP_REQUIRED`; the profile UI then sends a `purpose: "reauthenticate"` code to the customer's own phone/email (`startReauthAction` / `confirmReauthAction`), which sets `sessions.$.reauthenticatedAt` for this device only and retries. Contact-change starts are limited per user (5/h) and per IP (20/h) before the "taken" check. `getCurrentSession()` calls `connection()` before reading the clock (partial prefetch otherwise fails with "unstable value"). E2E: `apps/web/tests/e2e/auth.spec.ts`.
  - **RBAC:** roles from the prototype matrix: Super Admin, Cinema Manager, Event Manager, Finance, Support. Permissions are `resource:action` strings (e.g. `movies:write`, `refunds:approve`) checked with `requirePermission()` in `packages/core/src/auth/admin/current-staff.ts`. The catalogue (`PERMISSIONS`: `<menu resource>:read|write` plus `refunds:approve`, `refunds:request`, `scan-qr:use`, `users:reset-password`) and the seeded `SYSTEM_ROLES` live in `packages/schemas/src/permissions.ts`; the matrix in the prototype covers only 5 modules, the rest was agreed 2026-10-13. Roles are data (`roles` collection, edited later at `/roles`), not hard-coded checks. Data scoping ("cinema only", "events only") is not enforced yet. The console menu (`apps/admin/src/lib/nav.ts`) hides what the role can't open; pages and actions still check.
  - **Vendor logins (built, back-office prompt 2, 2026-10-14):** same factories as staff, new instances in `packages/core/src/auth/partner/`: `tokens.ts` (aud `showbuzz-partner`, `PARTNER_JWT_*`), `cookies.ts` (`sbp_at` / `sbp_rt` path `/api/v1/partner/auth` / `sbp_has_session`, host-only), `sessions.ts` (`vendorUsers.sessions[]`, max 5 devices), `route-guard.ts` (`decidePartnerRoute`, open: /login, /signup, /forgot-password, /robots.txt). Shared with staff: `auth/password.ts` (bcrypt helpers; `admin/password.ts` re-exports), `auth/password-sign-in.ts` (`checkPasswordSignIn`: one message, dummy compare, per-email/per-IP limits; `PARTNER_AUTH` = the `ADMIN_AUTH` values), `auth/password-change.ts` (`changeAccountPassword`) and `auth/console-route-guard.ts` (`createConsoleRouteGuard`; `decideStaffRoute` is an instance). `vendor-auth.service.ts`: `signInVendorUser`, `startVendorSession`, `refreshVendorSession`, `currentVendor` (login + its vendor read per request), `signOutVendorUser`, `changeOwnVendorPassword`. `current-vendor.ts`: `getCurrentVendor()` / `requireVendor()` (401) → `{ vendorUser, vendor: VendorSummary, sid }`; `requireListingAccess()` (403 `ONBOARDING_INCOMPLETE` / `VENDOR_SUSPENDED`: every listing mutation in prompts 3–5 must call it); `requireVendorPage(path, { stage })` (console pages redirect to `/onboarding` until onboarding is complete; onboarding redirects finished vendors to `/dashboard`). A disabled login can't sign in; a suspended vendor can, sees a notice and can't change listings. Partner data scoping lives in `packages/core/src/services/partner/` and always takes the vendor id from the session.
  - **Vendor signup and onboarding (built, prompt 2):** `/signup` (`services/partner/signup.service.ts`): business name/type, contact, email, mobile, city, password; the mobile gets a code (`issueChallenge` purpose `vendor_signup`, no user behind it; logged like customer codes) and the final submit consumes it, checks it was sent to that number, then creates the vendor (`onboardingStatus: incomplete`, active, commission billing, `defaultCommissionBps`/fee/GST/cancellation from Settings) and its owner login in one transaction and signs in. 5 signups per IP per hour; a taken email answers a neutral 409. `/onboarding` (`services/partner/onboarding.service.ts`): business details → GSTIN + PAN (format + check digit; PAN must equal GSTIN characters 3–12) → bank account (typed twice) → documents (GST certificate, PAN card, cancelled cheque required; business registration optional; kind `business_registration` added) → review & submit (re-validates every step, then `complete`: listings live, no approval). Progress is derived from saved data; steps are editable only while incomplete; replacing a document deletes the old file; `GET /api/v1/partner/documents/[fileId]` serves the vendor's own files only. Every step is logged (`logActivity`, field names only; bank changes as `bank_account_change`). A super-admin-created vendor (prompt 6) gets a login with `createVendorUser()` (`auth/partner/vendor-user-account.service.ts`) and goes through the same steps.
  - **Partner venues, screens and seat layouts (built, prompt 3, 2026-10-14):** services `services/partner/venue.service.ts` (`listVendorVenues`, `getVendorVenue`, `createVenue`, `updateVenue`, `addScreen`, `updateScreen`, `deleteScreen`, `getSeatLayout`, `saveSeatLayout`, `listVendorLayouts`, `listVendorVenueOptions`) and `services/partner/seat-management.service.ts` (`listVendorShowOptions`, `getShowSeatBoard`, `blockShowSeats`, `unblockShowSeats`, `releaseHeldSeats`), every query filtered by the session's vendor id (another vendor's id → 404). Zod in `packages/schemas/src/partner-venue.ts`, views in `types/partner-venue.ts`; actions in `apps/partner/src/app/_actions/venues.ts` (`requireListingAccess`, `logActivity`, `revalidateWeb([venues])` for venue/screen/layout saves; per-show seat changes need none, seat maps are uncached). Rules: a venue with upcoming shows that have tickets sold can't go inactive; a screen with upcoming shows can't be removed; renaming a screen updates upcoming shows' `screenName` and the seeded templates. **Layout save** (`saveSeatLayout`): refused (409, `details.shows` = affected shows and seats) if a seat sold or held for an upcoming show would disappear, change category or become blocked; written conditionally on the venue's `updatedAt` (stale → 409 "reload"); existing category ids are kept (shows price by them), new ones get a slug id; upcoming shows receive new categories at their default price (existing show prices unchanged) and lose per-show blocks on seats that no longer exist. New screens start with rows A–H × 12 ("Regular", ₹250). The designer and the live map share `apps/partner/src/components/seats/use-seat-selection.ts` (pointer events + `elementFromPoint`, rectangle drag, Shift/Ctrl adds). Releasing a hold that belongs to an unpaid order makes that payment fail and refund (confirmation needs every seat still held).
  - **Partner movies, events and shows (built, prompt 4, 2026-10-14):** services in `services/partner/` (`movie.service.ts`, `listing.service.ts`, `show-schedule.service.ts`, shared `ids.ts`), Zod in `packages/schemas/src/partner-listing.ts` (+ `types/partner-listing.ts`), actions `apps/partner/src/app/_actions/{movies,events,shows}.ts` (`requireListingAccess`, `logActivity`, `revalidateWeb`: movies → movies; events → events + shows; shows → shows, + events when a fixture's prices change). **Movies:** shared catalogue; a vendor's "My movies" list is `vendorMovies` (`{ vendorId, movieId }`, unique) and scheduling needs the film on it. "Add movie" = catalogue search (title, language, release year); "Create new" sets `createdByVendorId` and links it; `findPossibleDuplicates` (normalised title contains / ≥60% shared words) is a warning plus one confirmation. Only the creator edits (403 otherwise; update conditional on `createdByVendorId`); editorial fields (rating, votes, trending, seeded reviews) stay with the super-admin; vendors never delete films, they only remove them from their list (not while they have upcoming shows). **Events / plays / activities:** one form by kind; tiers keep their ids; the pass show is created/updated in the same transaction: a capacity change is one conditional `$inc` of `capacity` and `remaining` (guarded on the capacity read and `remaining ≥ −delta`), so capacity never drops below sold + reserved (reserved = capacity − remaining − sold; `releaseLapsedOrders` runs first, from `services/order-release.service.ts`, split out of booking.service because the partner app must not import the cached catalogue reads); a tier with sales can't be removed. **Sports are seated:** the listing picks a stadium screen and start time; its tiers are the screen's seat categories in layout order (tier id = zone id, `available` = seats) and saving creates/updates the fixture's one seated show (same overlap rule). Once tickets are sold or reserved, venue, screen and start time are locked and the listing can't go inactive. Events gained `status` (active | inactive, missing = active; `ACTIVE_EVENT_FILTER` in every public read) and `durationMinutes` (`durationLabel` is derived). **Shows:** movie shows only at the vendor's cinemas, film on its list, format from the screen, language from the film, a price per seat category (pre-filled from the layout; headline price = first category). Daily schedule = date range (≤31 days) × start times (≤12/day, ≤200 shows), all or nothing. Overlap: a show occupies [start, `endsAt` + 15 min) (`SHOW_TURNAROUND_MINUTES`); `claimScreenTime()` checks inside a transaction that first bumps `venues.scheduleVersion` (with `timestamps: false`, so the layout designer's `updatedAt` check is unaffected), so concurrent schedulers on one venue conflict and retry; unsold template (demo) shows with no seat activity give way and are cancelled; anything else answers 409 with `details.clashes`. Edit = prices and format before the start (new quotes only). Cancel = no sold seats (else "cancel the bookings first"); held seats and per-show blocks are deleted in the same transaction, so an unpaid order on it fails at confirmation and is refunded. Shows gained `status` (scheduled | cancelled, `LIVE_SHOW_FILTER`; cancelled shows are hidden from showtimes, seat pages, fixture lookups, pass lookups and the seat manager), `endsAt` and `source` (template | manual).
  - **Activity log (built, prompt 2):** `activityLogs` (`packages/db/src/models/ActivityLog.ts`, Zod `packages/schemas/src/activity-log.ts`): `actorType` staff | vendor, `actorId`, `vendorId?`, `action` (snake_case), `resource`, `resourceId?`, `summary`, `changedFields` (names only, never values), `ipPrefix`, `createdAt`. `logActivity(actor, entry)` (`services/activity-log.service.ts`) reads the IP from `headers()` and never fails the save it records (errors are logged). Every console mutation calls it after the change.
- **Domain model (MongoDB collections):** `users` (customers), `staff`, `roles`, `vendors`, `vendorUsers`, `plans`, `cities`, `languages`, `genres`, `movies`, `events` (one collection with `kind: concert | comedy | play | sport | activity | stream ...`), `venues` (cinemas, stadiums, grounds), `screens`, `seatLayouts`, `shows`, `seatHolds`, `bookings`, `payments`, `refunds`, `organisers`, `settlements`, `showSubmissions` (list-your-show), `offers`, `coupons`, `giftCards`, `foodItems`, `banners`, `reviews`, `notifications`, `pages`, `seoMeta`, `mediaAssets`, `activityLogs`, `settings` (single document), `leads` (corporate/contact).
  - Built so far (models in `packages/db/src/models/`, Zod in `packages/schemas/src/user.ts` and `staff.ts`):
    - `staff`: admin accounts. `email` (lowercase, unique), `passwordHash` (bcrypt), `roleId`, `status` active | disabled, `lastLoginAt`, `passwordChangedAt`, `sessions[]` (same sub-schema as users, `models/session.ts`). Serialisation drops sessions and hashes; `StaffSnapshot` (`{ id, name, email, role, permissions, lastLoginAt? }`) is the only staff shape sent to the browser.
    - `roles`: `name` (unique), `description`, `permissions[]`, `isSystem` (the five seeded roles).
    - `users`: customers. `phone` (E.164 `+91XXXXXXXXXX`) and/or `email` (lowercase), each with a unique partial index (only documents that have the field), at least one required unless `status: "deleted"`. `status` active | blocked | deleted (deleted = anonymised tombstone with `deletedAt`, kept for booking records). `sessions[]` holds one entry per signed-in device (`sid`, refresh-token hashes, expiry, user agent, IP /24 or /48 prefix only). `toJSON`/`toObject` drop `sessions` and every `*Hash` field; `user.toCustomerSnapshot()` → `{ id, name, email?, phone?, joinedAt }` is the only user shape sent to the browser.
    - `otpChallenges`: one OTP each (`channel` sms | email, normalised `identifier`, `purpose` sign_in | change_contact | delete_account, `userId` for the last two, `pendingName`, `codeHash` (HMAC, never the code), `attempts`/`maxAttempts`, `consumedAt`, `ipPrefix`). TTL on `expiresAt`; index `{ identifier, purpose, createdAt: -1 }`.
    - `rateLimits`: fixed-window counters (`key` = SHA-256 of the limiter key, `windowStart`, `count`), unique `{ key, windowStart }`, TTL on `expiresAt`.
  - **Catalogue (built, Phase 2 area 1, 2026-10-13):** one model per file, each with a `toX()` mapper that returns exactly the Zod shape the UI already used (`Movie`, `EventListing`, `Cinema`, `Coupon`, ...). Public ids are ObjectId strings, except cities (the slug, e.g. `kolkata`, is the id), ticket tiers (string ids inside the event) and coupons (looked up by `code`). URLs stay slug-based. Every catalogue document has `sortOrder` (seed order = editorial order).
    - `cities` (unique `slug`), `movies` (unique `slug`; editorial reviews embedded), `streamTitles` (unique `slug`), `coupons` (unique `code`), `foodItems` (unique `{ vendorId, code }`) / `giftCardDesigns` (unique `code`, the seed key such as `fb-1`).
    - `venues`: `kind` cinema | stadium | venue, unique `slug`, `status` active | inactive (missing = active; public reads use `ACTIVE_VENUE_FILTER`), `phone`. **Screens and seat layouts are embedded** (`screens[{ id, name, layoutType, formats, soundSystem?, zones[{ id, name, description, accent, recliner, defaultPricePaise, rows[{ row, count, aislesAfter[], accessibleSeats[], blockedSeats[] }] }] }]`): a layout is small, always read with its venue and edited with it. Read layouts through `toScreen()` (`models/Venue.ts`), which maps older documents (single `aisleAfter`, no blocked seats or prices) to the current shape. Seat ids stay row letter + number (A–Z, max 40 seats per row). Cinemas also hold `showTemplates` (daily slots). Event venues are created from each event's `venueName`.
    - `events`: `kind` event | play | sport | activity, unique `{ kind, slug }`, `schedule` stored with real Dates, optional `venueId`.
    - `shows`: `movieId` or `eventId`, `venueId`, `screenId`/`screenName`, `startsAt` (UTC), format, language, availability, `pricePaise` (top zone) and `zones[{ zoneId, name, description, pricePaise }]`. Unique `{ venueId, screenId, startsAt, movieId, eventId }`: `movieId` is part of the key because the demo screens every now-showing movie in every template slot (decided 2026-10-13). Show ids (`showIdSchema` = ObjectId) are what the seat page and the cart use.
    - `settings`: one document `{ key: "global" }` with `gstBps`, `convenienceFeeBps`, `maxTicketsPerOrder` (8), `cancellationCutoffMinutes` (20), `cancellationFeePaise` (5000), `seatHoldMinutes` (10), `defaultCommissionBps` (1000 = 10%, for new commission vendors; added 2026-10-14); Zod in `packages/schemas/src/settings.ts` (`SETTINGS_DEFAULTS` = the constants). `getSettings()` (`packages/core/src/services/settings.service.ts`, React `cache()` = once per request, defaults if missing/invalid) feeds pricing (max tickets; fees now come from the vendor, Settings fees are the defaults for new vendors), seat holds (max tickets, hold minutes; the seat page gets the limit as a prop) and booking (cutoff and fee only for bookings made before vendor policies; My Bookings gets them as props). Static copy (FAQ, terms, footer, PriceBreakdown labels) still uses the constants.
  - **Show generation (demo only since prompt 4):** `ensureMovieShows(dateKeys)` (`packages/db/src/shows.ts`) runs only for cinemas of vendors with `demoShowGeneration: true` (set by `pnpm db:seed` on the 3 demo vendors; real vendors are never flagged and their venues have no templates). It upserts with `$setOnInsert` every cinema template × now-showing movie for the given IST dates (`source: "template"`, `endsAt` = start + running time) (one `bulkWrite`, duplicate-key races ignored). It runs lazily from `listShowtimes` once per date per server instance (memoised on `globalThis`), and `pnpm db:seed` runs it for the 7-day window, so the demo never runs out of shows and no cron is needed. Sports fixtures get one seeded Show at their stadium (zones named and priced from the event's first three tiers); `getShowIdForEvent()` gives the sports page its seat-map link. Movie zone prices: top zone = template price, then −₹180 (floor ₹180) and −₹300 (floor ₹150).
  - **Catalogue caching:** every read in `catalog.service.ts` is `"use cache"` with `cacheTag(CATALOG_TAGS.<collection>)` and `cacheLife("hours")` (cities and gift-card designs `"days"`). Showtimes, show details and seat maps are uncached (time/availability-dependent). `revalidateCatalog(tag)` wraps `revalidateTag(tag, "max")`; it only affects the web app. The consoles call `revalidateWeb(tags)` (`packages/core/src/services/web-revalidate.service.ts`): it POSTs to web's `/api/internal/revalidate` with `Authorization: Bearer <REVALIDATE_SECRET>` (constant-time compare, `http/internal-auth.ts`) inside `after()`, 5 s timeout, failures logged and never thrown, so a save never waits or fails on it. Tag names live in `services/catalog-tags.ts` (importable without the `"use cache"` reads). Header search is a Server Action (`searchCatalogAction` → `searchCatalog(q)`: escaped case-insensitive substring match on titles, genres/languages, categories and venue names, 6 per type), debounced in `use-catalog-search.ts`.
  - **Customer data (built, Prompt C, 2026-10-13):**
    - `reviews`: `{ movieId, userId, authorName, rating 1–5 (prototype stars), text, status published | hidden, timestamps }`, unique `{ movieId, userId }`: submitting again updates the review. `review.service.addMovieReview` upserts the review and `$inc`s the movie's `userRatingCount` / `userRatingSum` in one transaction (+1 and +rating when new, +(new − old) when edited); `toMovie` exposes `userRating { average, count }` (absent until the first review), shown next to the catalogue /10 score on the movie page and cards. `submitReviewAction` calls `updateTag(CATALOG_TAGS.movies)` so the new average shows at once. Author name comes from the session. The movie page lists published reviews, then the catalogue's editorial seed reviews (still embedded on the movie).
    - `leads`: `{ type contact | corporate | show_submission, reference (unique, TKT-/CORP-/LYS-#####), name, email, phone?, fields (validated form payload), status new | in_progress | closed, ipPrefix, timestamps }`. `lead.service`: 5 submissions per IP prefix per hour (`consumeRateLimit`, 429 `RATE_LIMITED`); a hidden `website` honeypot in all three forms (filled → normal-looking reference, nothing stored). `listLeads({ type?, status?, page, limit })` is for the admin app (nothing else reads leads).
    - `wishlists`: one document per saved item `{ userId, kind movie | event, itemId, createdAt }`, unique `{ userId, kind, itemId }`, max 200; the kind is resolved on the server from the id. Client store `stores/wishlist.ts`: `localIds` (persisted, signed out) and `ids` (the list in use). `WishlistSync` (public layout) merges the device list into the account once at sign-in (`mergeWishlistAction`, unknown ids dropped) and clears it, otherwise loads `getWishlistAction`; sign-out returns to the device list. Signed in, `toggle` is optimistic and reverts with a toast if `setWishlistItemAction` fails.
  - **Gift cards (built, Prompt D, 2026-10-13):** `giftCards` `{ code, designId, amountPaise, balancePaise, purchaserUserId, purchaseBookingId (unique), recipientName, recipientContact, message?, status active | redeemed | expired | cancelled, expiresAt, transactions[{ type purchase | redeem | refund, amountPaise, bookingId, at }] }`. Service `packages/core/src/services/gift-card.service.ts`.
    - **Code:** 16 chars Crockford base32 (80 bits), stored readable without dashes (unique) so the buyer can see it again, shown as `XXXX-XXXX-XXXX-XXXX`; input normalised by `normalizeGiftCardCode` (O→0, I/L→1). **Valid 12 months** (`GIFT_CARD_VALIDITY_DAYS = 365`) from the confirmed purchase; expiry is read from `expiresAt` everywhere (no cron), `redeemed` when the balance hits 0.
    - **Ledger embedded:** each balance change is one update that `$inc`s `balancePaise` and `$push`es the transaction, so balance and history can't drift.
    - **Purchase:** confirming a `gift-card` order creates the card in the confirm transaction. Success page, My Bookings (`BookingView.issuedGiftCard`) and the profile "My Gift Cards" tab show code, balance, status and expiry.
    - **Redeem:** checkout "Apply Gift Card" (signed in, not for gift-card orders) puts `giftCardCode` in the cart; `priceOrder` looks it up on every quote (`lookupGiftCard`: 60/user and 200/IP-prefix lookups per hour, `GIFT_CARD_LOOKUP_LIMITS`) and applies `min(balance, total)` → `amounts.giftCardPaise`, `amounts.payablePaise` (= total − gift card). The booking stores `giftCardId`; the gateway payment covers only `payablePaise` (none when 0: the payment page shows "Confirm with Gift Card"). The balance is spent **only in the confirm transaction** with one conditional update (`status active, expiresAt > now, balancePaise ≥ share` → `$inc −share`); if it no longer applies the order fails and any gateway part is refunded in full.
    - **Cancellation:** refund = total − fee as before, but the fee comes out of the gateway part first: gateway refund `max(0, payable − fee)`, card return `giftPart − max(0, fee − payable)` (agreed 2026-10-13), returned in the cancel transaction (`refund` ledger entry; `redeemed` → `active`). `refunds` records `amountPaise` (gateway) and `giftCardPaise`; `paymentId` is absent when a gift card paid everything.
  - **Marketplace data model (built, back-office prompt 1, 2026-10-14):** every venue, event, show and booking belongs to one vendor; movies stay one shared catalogue. Zod in `packages/schemas/src/vendor.ts` (KYC formats incl. the GSTIN check digit, rates, cancellation policy, `maskAccountNumber`, `describeCutoff`), types in `types/vendor.ts`.
    - `vendors`: `businessName`, unique `slug`, `businessType` cinema_chain | event_organiser | venue_operator | other, `contact`, `address`, `kyc { gstin, pan, bankAccount { holderName, accountNumber, ifsc }, documents[{ fileId, kind, filename, contentType, size, uploadedAt }] }`, `onboardingStatus` incomplete | complete, `status` active | suspended, `billingModel` subscription | commission, `planId`, `commissionBps`, `convenienceFeeBps`, `gstBps`, `cancellation { allowed, cutoffMinutes, feePaise }`, `shareCustomerContact` (false). Mappers: `toVendorPublic` (name + policy, the only shape the public site gets), `toVendorSummary` (back office, account number masked `XXXXXX1234`), `toVendorKyc` (whole account number: only the vendor's own KYC screen and the super-admin's vendor detail).
    - `vendorUsers`: partner logins (`vendorId`, unique `email`, `passwordHash`, `role: "owner"`, `status`, `sessions[]` = shared session sub-schema). None are seeded (no demo passwords); prompt 2 adds the login and a create script. `plans`: `name` (unique), `monthlyFeePaise`, `active`.
    - Ownership: `vendorId` (required, indexed) on `venues`, `events`, `shows` (incl. pass shows; `ensureMovieShows` copies the cinema's and skips cinemas without one), `bookings` (absent only for gift card purchases = platform sales), `foodItems` (+ `venueIds[]`, empty = all that vendor's cinemas; unique `{ vendorId, code }`); optional on `payments`/`refunds`; `coupons.vendorId` null = platform coupon; `movies.createdByVendorId` null = platform. Stream titles and gift-card designs are platform-owned.
    - Money (`pricing.service`): the convenience fee and its GST use the show vendor's `convenienceFeeBps`/`gstBps` (`getSellerTerms()` in `vendor.service.ts`, read fresh once per request; a vendor that isn't active + onboarding complete answers 410, so its shows can't be quoted or booked; listings stay visible until admin prompt 6). Settings fees are now only the defaults for new vendors. `quote.rates` feeds the PriceBreakdown percentages. Vendor coupons apply only to that vendor's shows; platform coupons everywhere; /offers lists platform coupons only (`listPlatformCoupons`). Food must belong to the show's vendor/venue; the food step is `/booking/food?show=<id>`.
    - Settlement snapshot (`bookings.settlement`, `computeSettlement()` in `packages/schemas/src/settlement.ts`, agreed 2026-10-14): subtotal = tickets + food; commission = `commissionBps` × (subtotal − discount) for commission vendors, 0 for subscription vendors; `vendorSharePaise` = subtotal − discount − commission; the convenience fee + GST are the platform's; a gift card used to pay changes nothing. Rates are frozen at order time.
    - Cancellation: the booking stores the vendor's policy at purchase (`cancellationPolicy`); cutoff and fee come from it (older bookings: Settings). Cancellable only if the vendor policy and the venue's `cancellation.allowed` both allow it; public labels are built from the policy (`cancellationLabel()`). Who keeps the cancellation fee is decided with payouts (prompt 6); the fee is on the Refund.
    - Public display: cinemas show "by <business name>" (`Cinema.operatorName`), event/play/sport/activity pages "Organised by …" (`EventListing.organiserName`), cached under `CATALOG_TAGS.vendors`.
  - Identifiers are normalised by `toE164IndianPhone()` / `makeEmailSchema()` in `packages/schemas/src/common.ts` (used by sign-in, profile, checkout contact and lead forms) and parsed by `contactIdentifierSchema` into `{ channel: "sms", phone } | { channel: "email", email }`. Auth limits live in `AUTH` in `packages/schemas/src/constants.ts`. Store IPs only as `ipPrefix()` from `packages/core/src/http/request.ts`.
- **Booking & seat-locking rules (built, Prompt B, 2026-10-13):** flow seats → food → checkout → payment → success/failure; Server Actions in `apps/web/src/app/(public)/_actions/booking.ts` over `packages/core/src/services/{seat-hold,booking,availability}.service.ts`.
  - **Seat holds** (`seatHolds`: `showId`, `seatId`, `status` held | sold | blocked, `holderKey`, `bookingId?`, `expiresAt?`; `blocked` = the vendor took the seat off sale for that show, `holderKey: vendor:<id>`, no expiry): unique `{ showId, seatId }` + TTL on `expiresAt`. The unique index is what prevents double-booking; never check-then-insert. Sold seats keep their document without `expiresAt` (TTL never removes them); cancelling deletes the booking's seat documents. The TTL monitor runs about once a minute, so every query treats `expiresAt <= now` as free.
  - **Holds belong to the browser**, not the account: seats are picked before sign-in, so `holdSeatsAction` sets an httpOnly cookie `sb_hold` (`__Host-sb_hold` in production, random 32 bytes, 1 day) and holds store its SHA-256 (`packages/core/src/booking/hold-cookie.ts`). Sign-in doesn't touch it, so holds survive sign-in with no merge. `holdSeats()`: deletes stale expired holds on those seats, releases this browser's other holds (selection or show changed), refreshes seats it already holds, `insertMany(ordered: false)` the rest; a duplicate key deletes this request's inserts and answers 409 `SEAT_UNAVAILABLE` with `details.seats`. Hold length = Settings `seatHoldMinutes`. The seat map shows sold + others' holds as "sold" and pre-selects this browser's own holds (`SeatMap.ownHold`); the cart stores `hold { expiresAt, seatsHref }` and `HoldCountdown` (food/checkout/payment) and the seat page count down the real expiry, then send the customer back to seat selection.
  - **Tier passes** (events, plays, activities): one pass Show per listing (seeded, `screenId: "passes"`, no `startsAt` for daily activities) with `inventory[{ tierId, capacity, remaining, sold }]`. Reserve = one conditional update (`$elemMatch { tierId, remaining ≥ qty }` → `$inc remaining −qty`) when the order is placed; given back when the order fails, lapses (`releaseLapsedOrders`, run before reserving and before showing availability) or is cancelled. Listing pages show live counts through `LiveTierPicker` (Suspense, uncached); stadium stands count free seats per zone.
  - **Orders** (`bookings`): `placeOrder` (signed-in) supersedes the customer's other unpaid orders, re-prices everything (`quoteOrder` with `strictCoupon` and the hold key), links this browser's valid holds to the new booking (all or `409 HOLD_EXPIRED`) or reserves passes, inserts `pending_payment` with `bookingCode` `SB-XXXXXX` (unique, retried on collision) and `holdExpiresAt`, then `gateway.createPayment` + a `payments` row (`created`). Statuses: pending_payment → confirmed → cancelled, or → payment_failed / expired (inventory released; seat holds deleted on payment failure).
  - **Payment** (`packages/core/src/payments/gateway.ts`): `PaymentGateway { createPayment, confirmPayment, refund }`, chosen by `PAYMENT_PROVIDER`; `SimulatedGateway` succeeds or fails as the demo page asks ("Pay" / "Simulate failure", labelled "Demo payment") and refunds at once. `confirmPayment` (server only): already confirmed → no-op; hold expired → fail before asking the gateway (no charge); gateway failure → `payment_failed` + release + `/booking/failure?code=`; success → one transaction: booking `confirmed` (conditional on pending), holds → sold (all must still be held, else abort, mark failed and refund in full), pass `sold += qty`, payment `succeeded`. Transactions use `connection.transaction()` (Atlas replica set).
  - **Cancellation**: until the cutoff of the vendor policy stored on the booking (Settings for older bookings) before `startsAt`, if that policy and the venue allow it; refund = paid − the policy's fee (never negative). One transaction: booking `cancelled` (conditional on confirmed), seats deleted or passes returned, `refunds` row (`processing`, unique per booking); then `gateway.refund` marks it `processed`. Cancelling again returns the same refund and changes nothing.
  - My Bookings and the success page read `bookings` (confirmed and cancelled only, owner only; another customer's code looks missing). Failure page shows the order's own reason (owner only) and retries at seat selection (seated) or payment (passes, gift cards).
  - **Ticket QR (built, Prompt C):** `packages/core/src/booking/ticket-qr.ts`. Payload `SBT1.<base64url JSON { c: bookingCode, s: showId, t: seat/pass labels, i: issuedAt }>.<base64url HMAC-SHA256>` with `QR_SIGNING_SECRET`; `issuedAt` = confirmation time, so the QR is stable. `renderTicketQrSvg()` (qrcode → SVG, server only) feeds the success page and the "Show QR" toggle in My Bookings (upcoming confirmed bookings only; cancelled tickets show "Void"). `verifyTicketPayload()` checks the signature (constant-time), then the booking: valid only if confirmed and the show and seats still match; cancelled/pending → `not_confirmed`. The admin `/scan-qr` screen will call it and mark check-in once (idempotent; not built).
- **Pricing rules** (per vendor since back-office prompt 1; `settings` holds the defaults for new vendors): GST 18% on the convenience fee, convenience fee 8.5%, max tickets per order from settings, cancellation cutoff from settings, nominal cancellation fee ₹50. Seat zones: Recliner, Executive, Premium, Regular, VIP, Wheelchair; seats can be blocked. Coupon rules: percentage or flat, `maxDiscount`, `minOrder`, validity, usage limits (e.g. `SHOW50` = 50% up to ₹150, min order ₹300). All pricing is computed server-side in `pricing.service.ts`; the client total is display-only.
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
- **Server/client boundary:** anything under `packages/core/src/` starts with `import "server-only"`. Never import models or services into a `"use client"` file.
- **Types:** strict mode, `noUncheckedIndexedAccess`; no `any` (use `unknown` + narrowing / Zod parsing). Next 16 `params`, `searchParams`, `cookies()` and `headers()` are async: always `await` them.
- **Components:** Server Components by default; small client islands. Props typed with explicit interfaces. Use `next/image` (with `images.remotePatterns` in `next.config.ts`) and `next/link`.
- **Styling:** Tailwind utility classes; extract repeated patterns into components, not `@apply` soup. No inline `style` except dynamic values (e.g. seat grid positions).
- **Comments:** explain _why_, not _what_. No commented-out code.
- **Functions:** small and single-purpose; early returns.

## 9. Testing Guidelines

- **Build phase (decided 2026-10-13): tests are deferred.** Don't write new tests or run the test suites; verify with lint, typecheck and build, and give the user a short manual checklist instead. If existing tests stop compiling because the code they cover was removed, mark them `it.skip` with a one-line reason and list them in the report. The guidelines below apply again once tests are resumed.
- Every new feature or bug fix needs tests.
- Unit tests (`tests/unit/`): services, pricing, coupon logic, Zod schemas, utils.
- Integration tests (`tests/integration/`): route handlers and models against `mongodb-memory-server` (replica-set mode for transaction tests).
- E2E (`apps/web/tests/e2e/`): Playwright for the full booking journey (city → movie → showtime → seats → food → checkout → payment → ticket) and admin login + one CRUD flow per resource type.
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
- Don't modify: `showBuzz_HTML/` (reference only), `pnpm-lock.yaml` by hand, `.env*` files, generated `.next/` output.
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
- **Next.js 16:** middleware is now `apps/web/src/proxy.ts`; `next lint` is gone (use ESLint CLI); request APIs are async; Turbopack is the default bundler.
- **Tailwind v4:** no `tailwind.config.js`. Port the prototype tokens into `@theme` in `globals.css`. Class names like `bg-brand-indigo` keep working if the token is named `--color-brand-indigo`.
- **TypeScript 7** is the new native (Go) compiler. If an editor plugin or tool breaks on it, pin TypeScript 6.x temporarily and note it here.
- **Mongoose on Vercel:** reuse one cached connection (`globalThis._mongoose`) to avoid exhausting Atlas connections; define models as `models.Movie || model("Movie", schema)` to survive hot reload. Mongoose must not run in the Edge runtime (only Node runtime route handlers).
- **Transactions** need a replica set: Atlas works; local plain `mongod` does not (use Atlas dev cluster or `mongodb-memory-server` replica set).
- **Remote images:** prototype uses Unsplash URLs; add `images.unsplash.com` to `images.remotePatterns` until real media storage is in place.
- **Timezone:** all dates stored in UTC, displayed in IST. Never parse prototype display strings like `"Sun, 23 Aug 2026"` as dates.
- **Undecided:** payment gateway (Razorpay vs Cashfree), OTP provider, media storage, rich-text editor, email provider.
- **Installed vs target versions:** the repo currently has TypeScript 5.x and ESLint 9 (§2 lists the targets); `@types/node` is on 24 (Vitest 5 requires ≥22). Vitest 5 runs on Vite 8, so `vite` and `@testing-library/dom` are explicit dev dependencies. Tailwind runs through the `@tailwindcss/turbopack` loader in `next.config.ts`, not `@tailwindcss/postcss`.
- **Cache Components is on** (`cacheComponents` + `partialPrefetching`). Anything reading `searchParams`, `cookies()`, `headers()` or the current time must sit inside `<Suspense>` (call `connection()` before `new Date()`). Client libraries that read the clock while rendering (e.g. Swiper) must mount after hydration (`useMounted`). `next build` enforces this.
- **Route types:** `PageProps<"/route">` types come from `next typegen`; `pnpm typecheck` runs it first.
- **`server-only`** is resolved by Next's internal alias (no npm package installed). Vitest aliases it to `packages/config/vitest/server-only.ts`; scripts run through `tsx --tsconfig tsconfig.scripts.json` (in `packages/db`), which maps it to the same stub.
- **`connection()` outside Next** throws ("called outside a request scope"). Tests that call route handlers directly get a no-op stub from `packages/config/vitest/next-request.ts` (unit and integration projects).
- **Line endings:** `.gitattributes` forces LF (Prettier's default) even with `core.autocrlf=true` on Windows. Formatting is Prettier (`printWidth` 120, Tailwind class sorting incl. `cn()`/`clsx()`); don't hand-format.
- **Integration tests** (in each package/app that has them) get `MONGODB_URI`/`MONGODB_DB` from their own in-memory replica set (`packages/config/vitest/mongo-setup.ts`), which refuses any non-local URI, so `.env.local` is never used by tests. Within a workspace, test files run one at a time and share one server: clean up what you create.
- **`AGENTS.md`** (in each app folder, e.g. `apps/web/AGENTS.md`) is (re)generated by `next dev`; commit it or it keeps reappearing.
- **Phase 1 stand-ins:** the catalogue is in MongoDB (seed data in `packages/db/scripts/seed-data.ts`, used only by `pnpm db:seed`; no service imports it). Bookings, seats and payments are in MongoDB (see "Booking & seat-locking rules"); payment is simulated (`PAYMENT_PROVIDER=simulated`, also on Vercel production) until a gateway is chosen. The prototype's fixed sold seats were dropped (2026-10-13): maps show only real sales and holds. Event tiers' `available` in the catalogue is now only the seeded capacity; live counts come from the pass show. The cart store is `version: 1` (older carts with pre-ObjectId ids are dropped); a device-local wishlist with pre-database ids loses them when merged at sign-in (unknown ids are dropped). Reviews, leads and signed-in wishlists are in MongoDB too (Prompt C); no in-memory stores remain. Gift cards (Prompt D) are not delivered to the recipient yet (no email/SMS provider): the buyer sees the code on screen and passes it on; add delivery with the email provider. Bookings and reviews are scoped to the signed-in customer (batch 1.8): `placeOrderAction`, `confirmPaymentAction`, `cancelBookingAction` and `submitReviewAction` use `requireCustomer()` and never take a user id or author name from the client; `getBooking`/`listBookings`/`cancelBooking`/`confirmPayment` take the owner's `userId` and answer another customer's booking exactly like a missing one (404); `BookingView` never includes `userId`. Sign-in is required before payment (decided 2026-10-13): checkout/payment open the sign-in modal with `next` back to the same step, and the ticket contact uses the account's phone/email when it has them. One review per customer per movie: submitting again updates it (decided 2026-10-13). The booking success page requires sign-in and shows only the owner's booking.
- **OTP sign-in is on MongoDB** (`packages/core/src/auth/otp.ts`: `otpChallenges`, rate limits, atomic attempts and single use, find-or-create user). No SMS/email provider yet: with `OTP_PROVIDER=none` (default) `LogOtpSender` writes each code to the server log (Vercel logs) in every environment, and outside production the code is also returned as `devCode` for on-screen display. This is a temporary, agreed exception to "never log OTPs"; remove it when a provider is added (`packages/core/src/auth/otp-delivery.ts`, steps in `docs/auth.md` §7). `OTP_PROVIDER=dev` shows the code on screen only (no log) and is what E2E uses; boot rejects it in production. Account pages are protected by `proxy.ts` + `requireCustomerPage()`, and the public UI runs on real sessions (batch 1.6). Profile, contact verification, sessions and account deletion are database-backed (batch 1.7); checkout and reviews are bound to the session server-side (batch 1.8).

- **Admin password recovery is a stand-in:** no email provider yet, so `/forgot-password` says "Ask a Super Admin to reset your password". A Super Admin (`users:reset-password`) sets a temporary password from `/users` (shown once, target signed out everywhere); the staff member then changes it at `/profile`. Replace with an emailed reset link when an email provider is chosen. The admin dashboard shows labelled sample figures and every unbuilt menu page renders "Coming soon".
- **KYC file storage is a stand-in:** no media provider yet, so KYC documents live in MongoDB GridFS (bucket `files`) behind the `FileStorage` interface (`packages/db/src/storage/file-storage.ts`: `put/get/delete`, PDF/JPEG/PNG checked by their first bytes, max 4 MB for Vercel's body limit, owner in file metadata). Files are private: whoever serves one must check the owner first. Swap the implementation for S3 / Vercel Blob when `MEDIA_STORAGE_*` is decided. The seed stores generated "DEMO DOCUMENT" PDFs for the three demo vendors.
- **Demo vendors (seed):** Kolkata Screens Pvt Ltd (commission 10%, fee 8.5%, cancel up to 20 min, ₹50; PVR INOX Quest, Cinépolis Acropolis, PVR ICON Mumbai), Bengal Picture Palace LLP (subscription on "Demo Monthly" ₹9,999, fee 6%, 2 h, ₹30; INOX Insignia, Miraj), Festive Nights Entertainment Pvt Ltd (commission 12%, fee 10%, 24 h, ₹100; every event, play, sport, activity and their venues). Fictional businesses, fake but valid-format KYC; vendor rates/policy/KYC are set on first insert only. The seed also backfills `vendorId` + settlement on older bookings (fees at the Settings rates), payments and refunds, and drops the old unique `code_1` index on `foodItems`. Run `pnpm db:seed` after pulling this change: until then shows have no vendor and can't be booked.
- **Seat layouts (prompt 3):** the seed now writes venue profiles and screens with `$setOnInsert` (vendors edit them in the partner portal; `vendorId`, `kind`, `showTemplates`, `sortOrder` are still `$set`) and `backfillLayouts()` fills `status`, `aislesAfter`, `blockedSeats`, `formats` and default prices on older venues: run `pnpm db:seed` after pulling. Known gaps: the sold-seat check and the layout write are two steps, so a seat sold in that instant could end up outside the new layout (its ticket stays valid; a transaction would close it); renaming a seat category doesn't rename it on shows already scheduled (each show keeps its own zone names and prices; prompt 4 edits them). Venue `distanceLabel` is still seed-only. The designer validates with the shared Zod schema directly (it isn't a React Hook Form form).
- **Partner listings (prompt 4):** run `pnpm db:seed` after pulling: it flags the demo vendors `demoShowGeneration`, backfills `status`/`endsAt`/`source` on shows, fills each demo vendor's "My movies" from its shows, and now writes events (and fixture show prices) on first insert only, so vendor edits survive re-seeding. Until then no vendor gets template shows. Known gaps: changing a film's running time doesn't move `endsAt` of shows already scheduled; a fixture's tier prices and its show's zone prices are kept in step only through the partner forms; vendors can't edit editorial movie fields (rating, trending) or merge duplicates (prompt 6); new event slugs render on demand (not in `generateStaticParams` until the next build).
- **Partner portal stand-ins (prompt 2):** signup verifies only the mobile number (OTP logged as for customers, `devCode` on screen outside production); the email is not verified until an email provider exists. `/forgot-password` says to ask the ShowBuzz account manager (vendor password reset arrives with the admin vendor screen, prompt 6). Dev-only demo logins: `pnpm db:seed-demo-vendors` (after `pnpm db:seed`) → `screens@showbuzz.test` (Kolkata Screens), `palace@showbuzz.test` (Bengal Picture Palace), `events@showbuzz.test` (Festive Nights), password `12345678`; refuses to run in production. Partner pages not built yet render "Coming soon"; the dashboard shows the vendor's name, status and billing terms only (sales figures in prompt 8).
- **Console kit:** `packages/console-ui` holds the shell and kit both consoles use; its Prettier config sorts classes against `apps/admin/src/app/globals.css` (theme tokens come from `src/theme.css`, imported by each app). The shell's `useEffect` dependency warning (`setOpen`) predates the move.
- **Admin and partner app rendering:** `apps/admin` and `apps/partner` do not use Cache Components (so they must not call the `"use cache"` reads in `catalog.service.ts`); their root layouts set `dynamic = "force-dynamic"`, so no console page is prerendered or cached. The partner app allows 5 MB Server Action bodies (KYC uploads). Pages get `robots: noindex` metadata, an `X-Robots-Tag` header and a disallow-all `robots.txt`.

### Monorepo (pnpm + Turborepo) gotchas

- **Strict dependencies:** pnpm doesn't hoist. A workspace can only import packages listed in its own `package.json`
  (internal ones as `"@showbuzz/x": "workspace:*"`, external ones as `"catalog:"`). "Works on my machine" import
  errors usually mean a missing declaration, not a missing install.
- **Build scripts are opt-in:** `allowBuilds` in `pnpm-workspace.yaml` lists which packages may run install scripts.
  Only `esbuild` is allowed. `mongodb-memory-server` is denied on purpose (it would pre-download mongod at install);
  `unrs-resolver` is denied (prebuilt binding). A new `ERR_PNPM_IGNORED_BUILDS` means decide per package, not "allow all".
- **One mongoose copy:** only `@showbuzz/db` depends on mongoose. Other packages import `Types` etc. from
  `@showbuzz/db/mongoose`. Turbopack resolves the external mongoose for apps by itself (`.next/node_modules/mongoose-*`).
- **One next/react copy:** `@showbuzz/core` and `@showbuzz/ui` take next/react as peer dependencies (plus catalog dev
  dependencies). If pnpm ever resolves two `next@…` variants, `cookies()`/`headers()` inside core break; check
  `node_modules/next` resolves to the same `.pnpm` folder in the app and in core after dependency changes.
- **Turbo hides env vars:** tasks only see variables declared in `turbo.json` (`env` / `passThroughEnv`). New
  variables must be added there or they are `undefined` in builds/tests run through turbo. Next still reads
  `.env.local` from the app folder itself.
- **Tests and mongod:** the `@showbuzz/config#mongod` task fetches the mongod binary once into the root
  `node_modules/.cache/mongodb-binaries` before any test task (parallel packages would otherwise race on the download
  lock). Integration tests only accept the local in-memory server, never `.env.local`.
- **Two dev servers:** Next 16 refuses a second `next dev` in the same app folder, so stop `pnpm dev` before `pnpm test:e2e`.
- **Tailwind and packages/ui:** classes used in `packages/ui` are generated because `apps/web/src/app/globals.css`
  has `@source "../../../../packages/ui/src"`; a new shared UI package needs the same line in each app.

### Vercel (one project per app)

| Project          | Root Directory | Domain                 | Install command | Build command          | Ignored build step |
| ---------------- | -------------- | ---------------------- | --------------- | ---------------------- | ------------------ |
| showbuzz-web     | `apps/web`     | `showbuzz.com`         | `pnpm install`  | default (`next build`) | `npx turbo-ignore` |
| showbuzz-admin   | `apps/admin`   | `admin.showbuzz.com`   | `pnpm install`  | default (`next build`) | `npx turbo-ignore` |
| showbuzz-partner | `apps/partner` | `partner.showbuzz.com` | `pnpm install`  | default (`next build`) | `npx turbo-ignore` |

- Keep "Include files outside the Root Directory" on (packages are outside the app folder). Vercel detects pnpm from
  `pnpm-lock.yaml` + `packageManager` at the repo root.
- `turbo-ignore` skips a deployment when nothing the app depends on changed, so a web-only change doesn't rebuild admin.
- Env vars are set per project and per environment; admin and partner get their own secrets (no shared cookies or
  Domain attribute between the hosts). `REVALIDATE_SECRET` must be the same in all three projects, and admin/partner
  need `WEB_APP_URL=https://showbuzz.com`.

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
- Customer auth (flows, threat model, production checklist): `docs/auth.md`
- API spec: `docs/openapi.yaml` (OpenAPI 3.1; update it with every endpoint change)
- Issue tracker: <link — not yet provided>
