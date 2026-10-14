# Prompts: Marketplace back office (super-admin + vendor portal)

ShowBuzz is a multi-vendor marketplace with three apps:

| App | Domain | Users |
|---|---|---|
| `apps/web` | showbuzz.com | Customers |
| `apps/admin` | admin.showbuzz.com | Super-admin (the client's team): vendors, plans, fees, payouts, platform content |
| `apps/partner` (new) | partner.showbuzz.com | Vendors: their own venues, screens, seats, movies, events, shows, prices, offers, bookings, earnings |

## Decisions (2026-10-13)

- Vendors can list everything: cinemas/movies, events, plays, sports, activities.
- **Movies are one shared catalogue (BookMyShow style):** one public page per film listing every cinema showing it.
  A vendor adding a movie searches first and reuses it if it exists, otherwise creates it. The creating vendor and
  the super-admin can edit it; the super-admin can merge duplicates. Events, plays, sports and activities belong to
  one vendor.
- Vendors sign up themselves, or the super-admin creates them. **KYC is mandatory during onboarding** (business
  details, GSTIN, PAN, bank account, documents). Once onboarding is complete, listings go live immediately with no approval.
- **Billing model per vendor: subscription only or commission only** (not both). The super-admin sets each vendor's
  model, plan or commission %, convenience fee and GST.
- Default until decided otherwise: a subscription is a monthly invoice the super-admin marks paid by hand
  (no online payment until a gateway is chosen); the super-admin can suspend a vendor who doesn't pay.
- Vendors create offers and coupons for their own listings only. Who pays for a discount is not settled yet: for now
  a vendor coupon reduces that vendor's sales, and no platform-funded coupon logic is built. The existing
  public coupons stay as platform coupons.
- Each vendor sets its own cancellation policy.
- Vendors see **booking code, seats and amount** only. Customer contact details are hidden unless the super-admin
  turns on "share customer contact" for that vendor (off by default).
- One login per vendor for now, modelled so vendor roles can be added later.

## The prompts

| # | Prompt | Needs first |
|---|---|---|
| 1 | Marketplace data model (vendors, ownership, per-vendor rates and policy) | public A–D (all done) |
| 2 | Shared console kit + partner app + vendor signup and onboarding | 1 |
| 3 | Partner: venues, screens, seat layout designer | 2 |
| 4 | Partner: movies, events, shows and pricing | 3 |
| 5 | Partner: bookings, QR scan, food menu, offers, cancellation policy, earnings | 4 |
| 6 | Admin: vendors, plans, subscriptions, payouts, movie merge | 5 |
| 7 | Admin: platform operations and content | 2 |
| 8 | Admin: dashboard, reports, notifications | 6 |

Later, when needed: media library, backup export, audience analytics, vendor team roles, platform-funded coupons,
online subscription payments, real payment gateway, email/SMS provider.

**Run order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8, one Claude Code session at a time (they share packages).
Paste each prompt into a fresh session (`/clear` first).

---

## Shared rules (every prompt below points here)

```text
Shared rules for back-office prompts (docs/prompts/phase-3-admin.md; read the Decisions section too):
- Read first: CLAUDE.md, the prototype pages named in the prompt (../showBuzz_HTML/admin/<page>.html plus -form /
  -details variants and admin/assets/js/*.js for behaviour), and the existing console code (apps/admin, and
  apps/partner + packages/console-ui once they exist). Follow their patterns.
- Plan first (pages, models/fields, services, open questions) and wait for my OK.
- Reproduce the prototype's layout and fields with real data. Names: "ShowBuzz Admin" (admin.showbuzz.com),
  "ShowBuzz Partner" (partner.showbuzz.com). If something needs an undecided provider (email/SMS, payment
  gateway), build it with a clearly labelled stand-in and note it in CLAUDE.md §12.
- Data separation is the most important rule. Every partner query and mutation is scoped to the signed-in
  vendor's vendorId, taken from the session on the server, never from the request. A vendor asking for another
  vendor's record gets 404. Put the scoping in services (packages/core/src/services/partner/...), not in pages.
- Admin pages: requireStaffPage + the menu item's permission. Partner pages: the partner session guard from
  prompt 2. Every mutation is a Server Action that checks auth/permission, validates with Zod from
  packages/schemas, calls a service, and records logActivity(...) (actor = staff or vendor).
- Lists: server-side pagination, search, sort and filters via URL search params; empty/loading/error states.
  Forms: React Hook Form + the same Zod schema as the server.
- Prefer status changes (inactive / archived / cancelled) over deletes for anything other records reference.
- After changing anything the public site shows, call revalidateWeb(tags) so showbuzz.com updates.
- Money in paise, dates stored UTC and shown in IST.
- Tests are deferred (CLAUDE.md §9): don't write or run tests; verify with pnpm lint, pnpm typecheck, pnpm build.
  Don't click through the apps yourself; end with a short manual checklist for me.
- Don't install or download anything without asking me first (what, from where, how big).
- Work on main, don't commit. Update CLAUDE.md and docs/roadmap.md, and end with a summary and a suggested
  commit message.
```

---

## 1. Marketplace data model

```text
Back-office prompt 1 of 8. Follow the shared rules and Decisions in docs/prompts/phase-3-admin.md (read it first).

Turn the single-operator data model into a multi-vendor one. Backend only (packages + small public-site changes);
no new screens yet.

1. Vendor model: business name, slug, business type, contact person, email, phone, address, city,
   KYC (GSTIN, PAN, bank account holder / number / IFSC, document file refs), onboardingStatus
   (incomplete | complete), status (active | suspended), billingModel (subscription | commission),
   planId (for subscription), commissionBps, convenienceFeeBps, gstBps, cancellation policy (allowed yes/no,
   cutoff minutes, fee in paise), shareCustomerContact (default false), timestamps.
   VendorUser model: vendorId, name, email (unique), passwordHash, role "owner" (only value for now),
   status, sessions[] (reuse the shared session sub-schema). Plan model: name, monthly fee in paise, active.
   Bank account numbers are never returned whole outside the vendor's own KYC screen and the super-admin's
   vendor detail (mask elsewhere).
2. Ownership: add vendorId (required, indexed) to Venue, Event, Show (including the event "passes" shows) and
   Booking, and to Coupon (optional: null = platform coupon). Gift-card purchase orders are platform sales: their
   Booking has no vendorId and no vendor share. A gift card used to pay for a ticket is only a payment method,
   so it doesn't change the vendor's share. Movies stay one shared catalogue: add createdByVendorId
   (null = platform) and keep unique slugs; Shows link a movie to a vendor's venue. Stream titles and gift-card
   designs stay platform-owned. Food & beverage items become vendor-owned (vendorId plus optional list of that
   vendor's venues); the food step of checkout shows only the items of the show's vendor/venue.
3. Per-vendor money rules: pricing uses the show's vendor convenienceFeeBps and gstBps (platform Settings become
   the defaults for new vendors). Every Booking stores a snapshot: vendorId, billing model, rates used, ticket
   subtotal, discount, convenience fee, GST, total, and the vendor's share (subtotal − discount − commission for
   commission vendors; subtotal − discount for subscription vendors). Cancellation uses the vendor's policy.
   Vendor coupons only apply to that vendor's shows; platform coupons apply anywhere.
4. Document storage: KYC files need storage and no provider is chosen. Store them in MongoDB GridFS through a
   small FileStorage interface (put/get/delete) in packages/db so it can move to S3/Vercel Blob later; accept
   PDF/JPEG/PNG up to 4 MB (Vercel's request limit). No new dependency.
5. Seed: create 3 demo vendors with complete KYC (fake but valid-format values): two cinema chains and one
   events organiser. Split the existing cinemas between the two chains and give events, plays, sports and
   activities to the organiser. Give both cinema chains a copy of the current food menu. One commission vendor,
   one subscription vendor on a demo plan. Idempotent like the rest of db:seed. Backfill vendorId and the money
   snapshot on existing bookings, payments and refunds from their show (skip gift-card purchases).
6. Public site: show pages and event pages may show the vendor's business name (as the prototype shows cinema
   and organiser names); checkout totals now come from the vendor's rates; cancellation text uses the vendor's
   policy instead of the global constant.

Manual checklist: run the seed, book a movie at each cinema chain and compare fees, cancel inside and outside
each vendor's cutoff, check bookings have a vendor snapshot in the database.
```

---

## 2. Shared console kit, partner app and vendor onboarding

```text
Back-office prompt 2 of 8. Follow the shared rules and Decisions in docs/prompts/phase-3-admin.md (read it first).
Prompt 1 is done.

1. packages/console-ui (new): move the reusable parts of apps/admin (console shell taking the nav and branding
   as props, PageParts, form primitives) into it, then add the kit both consoles need: DataTable (server
   pagination/search/sort via search params, row actions), filter bar, form fields (text, number, select,
   multi-select, toggle, IST date/time, rupees ↔ paise money input, image URL with preview, file upload),
   confirm dialog, status badge, toasts. Admin keeps working exactly as before. Add the Tailwind @source line
   in each app.
2. Web cache refresh: POST /api/internal/revalidate in apps/web protected by REVALIDATE_SECRET (constant-time
   compare) calling revalidateCatalog for given tags; revalidateWeb(tags) in packages/core for both consoles
   (best effort, logs failures, never blocks a save). Add the env var to every app's env schema, .env.example and
   turbo.json; generate values into the .env.local files without printing them.
3. Activity log: ActivityLog model (actor type staff | vendor, actorId, vendorId if any, action, resource,
   resourceId, summary, changed field names only, ipPrefix, createdAt) + logActivity().
4. apps/partner (new Next.js app, dev port 3002, same setup as apps/admin: catalog versions, transpilePackages,
   admin design tokens with "ShowBuzz Partner" branding, noindex, security headers, turbo.json, .env.example,
   Vercel notes in CLAUDE.md for partner.showbuzz.com).
5. Vendor auth (generalise the existing token codec / session store / cookies, don't copy them): aud
   "showbuzz-partner", PARTNER_JWT_ACCESS_SECRET / PARTNER_JWT_REFRESH_SECRET, host-only cookies (sbp_*),
   email + password (bcryptjs, same rules and rate limits as staff), refresh + logout routes, proxy.ts guard,
   getCurrentVendor() / requireVendor() / requireVendorPage() returning { vendorUser, vendor } from the server
   session. A suspended vendor can sign in but sees a "suspended" notice and can't change listings.
6. Signup and onboarding (prototype has no partner pages: use the admin design and the public
   list-your-show.html for tone): /signup creates the vendor + owner login (verify the mobile number with the
   existing OTP service, which logs the code as today). Then a mandatory multi-step onboarding: business details
   → GSTIN/PAN (format-validated) → bank account → document uploads (GST certificate, PAN card, cancelled
   cheque, plus business registration if the prototype or common practice suggests) → review & submit.
   Until onboarding is complete the vendor can only see onboarding; after that, everything is live with no
   approval. A super-admin-created vendor goes through the same steps (prompt 6 adds that admin screen).
   New vendors default to commission billing with the platform's default rates.
7. Partner shell: menu (Dashboard, Venues & Screens, Seat Layouts, Movies, Events, Shows, Bookings, Scan
   Tickets, Food & Beverages, Offers & Coupons, Cancellation Policy, Earnings, Business Profile), profile with password change.
   Pages not built yet show "Coming soon"; Dashboard shows the vendor's name and onboarding/billing summary.

Manual checklist: sign up as a new vendor, finish onboarding with uploads, sign in to partner.showbuzz.com
locally (:3002), confirm a demo vendor login works, confirm admin still works unchanged.
```

---

## 3. Partner: venues, screens and seat layouts

```text
Back-office prompt 3 of 8. Follow the shared rules and Decisions in docs/prompts/phase-3-admin.md (read it first).
Prompts 1–2 are done. Everything here is in apps/partner and scoped to the signed-in vendor.

Prototype pages for layout and fields: admin/cinemas, cinema-form, venues, venue-form, screens, seat-layout,
seat-management, admin/assets/js/seats.js. Screens and seat layouts are embedded in the Venue (CLAUDE.md §7).

1. Venues: the vendor's cinemas, stadiums and other venues: list + create/edit (kind, name, slug, city, address,
   amenities, status). New venues appear on the public site at once.
2. Screens / auditoriums per venue: name, layout type, formats.
3. Seat Layout Designer (no drag-and-drop library; click and drag-select on a grid): rows and seat counts per
   seat category, aisles, categories (Recliner, Executive, Premium, Regular, VIP, Wheelchair, or the vendor's own
   category names), blocked seats, and a default price per category. Saving must not remove or move a seat already
   sold for a future show: refuse and list the affected shows.
4. Seat management: pick one of the vendor's shows and see its live map (sold, held, blocked, free); block/unblock
   seats for that show; release a stuck hold.
5. revalidateWeb on every save that changes public pages; logActivity on every save.

Manual checklist: as a demo vendor, add a cinema with a screen and seat layout; confirm another vendor can't
open it by URL; block a seat and see it unavailable on the public seat map.
```

---

## 4. Partner: movies, events, shows and pricing

```text
Back-office prompt 4 of 8. Follow the shared rules and Decisions in docs/prompts/phase-3-admin.md (read it first).
Prompts 1–3 are done.

Prototype pages: admin/movies, movie-form, events, event-form, plays, sports, activities, shows, show-form.

1. Movies (shared catalogue): "Add movie" starts with a search over existing movies (title, language, year).
   Picking one adds it to the vendor's list for scheduling; "Create new" opens the full movie form (all fields the
   public movie page shows: titles, slug, synopsis, duration, certificate, languages, genres, formats, release
   date, status, poster/backdrop/trailer URLs, cast & crew rows) with a "possible duplicates" warning by title.
   Only the creating vendor (and super-admin) can edit a movie; others see it read-only.
2. Events, plays, sports, activities: the vendor's own listings, one form driven by kind (title, slug, category,
   description, venue from their venues, schedule in IST, ticket tiers with price and capacity, images, status).
   Tier changes must update the listing's pass show inventory (packages/core availability/pass logic): new
   remaining = capacity − sold − reserved, and capacity can't go below what's already sold or reserved.
3. Shows: list the vendor's shows (filter by date, venue, movie/event), create a show (venue + screen + movie or
   event + start time in IST + format/language + price per seat category, defaulting to the layout's prices),
   bulk-create a daily schedule for a date range, edit price/format, cancel a show (only with no sold seats; else
   ask to cancel the bookings first). No overlapping shows on a screen (start + duration + 15-minute buffer).
   The automatic template-based show generation from the catalogue batch becomes demo-only for the seeded vendors;
   say in the plan how you'll keep it from creating shows for real vendors.
4. revalidateWeb + logActivity on every save.

Manual checklist: as vendor A, reuse an existing movie and schedule shows; as vendor B, create the same movie
and see the duplicate warning; confirm the public movie page lists both vendors' cinemas; create an event with
tiers and book it publicly.
```

---

## 5. Partner: bookings, scan, offers, policy, earnings

```text
Back-office prompt 5 of 8. Follow the shared rules and Decisions in docs/prompts/phase-3-admin.md (read it first).
Prompts 1–4 are done. Reuse the existing booking, cancellation and QR code in packages/core
(booking.service, ticket-qr.ts verifyTicketPayload); don't duplicate their rules.

Prototype pages: admin/bookings, booking-details, booking-form, scan-qr, coupons, offers, settlements.

1. Bookings: the vendor's bookings only: booking code, show, seats/tiers, amount, status, check-in. Customer
   name/phone/email appear only when the vendor's shareCustomerContact is on. Vendor can cancel a booking
   (refund follows their policy; an override reason is required after the cutoff).
2. Counter booking (POS): vendor staff sell at the box office: show → seats/tiers → payment "counter cash" or
   "counter UPI" (recorded, no gateway) → confirmed booking with the normal QR ticket.
3. Scan Tickets: browser BarcodeDetector camera scan where supported, manual code entry as fallback (no new
   dependency; ask if you think one is needed). Verify with verifyTicketPayload, accept only this vendor's
   bookings, mark checked-in once with an atomic update (add checkedInAt / checkedInBy to Booking; "already
   checked in at ..." on repeat). The partner app needs QR_SIGNING_SECRET (same value as web): add it to its env
   schema, .env.example and turbo.json, and copy the value into apps/partner/.env.local without printing it.
   camera=(self) in the partner app's Permissions-Policy.
4. Food & Beverages: the vendor's food menu (name, category, veg/non-veg, price, image URL, which of their
   venues, available on/off), using the FoodItem fields the public food step already shows.
5. Offers & Coupons: the vendor's own coupons (code, percent or flat, max discount, min order, validity, usage
   limits, which of their venues/listings) and offers shown on the public offers page labelled with the vendor.
6. Cancellation Policy: edit allowed yes/no, cutoff, fee; shown on public pages for their shows.
7. Earnings: per period, the vendor's sales, discounts, refunds, commission (commission vendors) and their share;
   payouts received (from prompt 6); subscription invoices and status (subscription vendors). Read-only.
8. Business Profile: view/edit business details, KYC and bank (re-upload documents); changing bank details is
   logged.

Manual checklist: book publicly at vendor A, see it in A's bookings without contact details, scan it twice,
create a vendor coupon and use it publicly only on A's shows, change A's cutoff and cancel a booking.
```

---

## 6. Admin: vendors, plans, subscriptions and payouts

```text
Back-office prompt 6 of 8. Follow the shared rules and Decisions in docs/prompts/phase-3-admin.md (read it first).
Prompts 1–5 are done. Everything here is in apps/admin (super-admin).

Prototype pages: admin/organisers, organiser-details, settlements, payments, refunds, list-your-show.

1. Vendors: list (search, filter by status, billing model, city), detail (business profile, KYC with document
   viewer served through an authenticated route, listings count, sales summary), create a vendor on their behalf
   (same onboarding steps as the partner signup), suspend / reactivate (suspended vendors' listings disappear from
   the public site and they can't edit), and per-vendor settings: billing model (subscription or commission),
   plan, commission %, convenience fee, GST, shareCustomerContact. Reset a vendor's password (temporary password
   shown once).
2. Plans: CRUD for subscription plans (name, monthly fee, active).
3. Subscription invoices: generate monthly invoices for subscription vendors (idempotent per vendor + month),
   list, mark paid with a reference, overdue view.
4. Payouts (settlements) for commission vendors: for a vendor and date range, sum the booking snapshots
   (vendor share of confirmed bookings, minus refunds), create a Settlement (pending → paid with a reference).
   A booking belongs to at most one settlement. Subscription vendors get payouts of their full share the same way.
5. Payments and refunds: platform-wide lists with vendor filter, labelled "Simulated gateway".
6. List-your-show requests: show_submission leads with status and notes, plus a "Create vendor" action that
   pre-fills the vendor form.
7. Movies: platform-wide movie list with "merge duplicates" (pick the movie to keep; shows move to it; the other
   is archived and its slug redirects).

Manual checklist: create a vendor from admin, change a vendor to subscription on a plan, generate and mark an
invoice paid, run a payout for a commission vendor and see it in their partner Earnings, suspend a vendor and
check the public site, merge two duplicate movies.
```

---

## 7. Admin: platform operations and content

```text
Back-office prompt 7 of 8. Follow the shared rules and Decisions in docs/prompts/phase-3-admin.md (read it first).
Prompts 1–6 are done. Reviews, leads (listLeads) and gift cards already exist in MongoDB with their services;
build on them. Everything here is in apps/admin.

Prototype pages: cities, languages, genres, settings, users, roles, activity-log, customers, customer-details,
bookings, reviews, banners, coupons, gift-cards, pages, seo.

1. Master data: cities (public city picker), languages and genres (new collections seeded from values in use;
   option lists for movie/event forms in both consoles).
2. Platform settings: default convenience fee, GST and commission for new vendors, max tickets per order,
   seat hold minutes, and other prototype settings worth keeping (list them in the plan).
3. Staff and roles: the platform team only. Staff list/create (temporary password shown once)/edit/disable; can't
   disable yourself or the last Super Admin. Roles editor with the permission matrix; review the seeded system
   roles: Cinema Manager and Event Manager were vendor-style roles, so replace them with platform roles
   (e.g. Operations, Finance, Support, Marketing) and say how in the plan.
4. Activity log page: filter by actor (staff/vendor), vendor, resource, date.
5. Customers: list, detail (bookings across vendors), block / unblock (signs them out).
6. Bookings oversight: all vendors' bookings with filters; view details; cancel/refund with override reason.
7. Reviews moderation: hide / publish, updating the movie rating aggregate atomically.
8. Home banners: Banner model (image URL, link, placement, city or all, dates, sort order with up/down, active);
   the public home hero reads active banners (fallback to today's content).
9. Platform coupons (the existing ones): CRUD with usage limits. Gift cards: list, details, cancel, issue a
   complimentary card.
10. Website pages (About, Privacy, Terms, FAQ) as editable structured content (headings, paragraphs, lists as
    fields; no rich-text dependency unless I approve) and SEO meta per page/listing; public pages read them with
    cache tags and fall back to current content.

Manual checklist: add a city, change default rates and create a vendor to see them applied, create a staff
member with a custom role, block a customer, hide a review, add a home banner, edit the Terms page.
```

---

## 8. Admin: dashboard, reports and notifications

```text
Back-office prompt 8 of 8. Follow the shared rules and Decisions in docs/prompts/phase-3-admin.md (read it first).
Prompts 1–7 are done.

Prototype pages: dashboard, reports, notifications (analytics is later).
Candidate dependency: chart.js + react-chartjs-2 (the prototype uses Chart.js). Ask me before installing.

1. Super-admin dashboard (replace the labelled sample figures): for today / 7 / 30 days: gross sales, platform
   revenue (convenience fees + commission + subscription invoices paid), tickets sold, active vendors, new vendors,
   top vendors, top movies/events, sales by city, recent bookings. Aggregations in a dashboard service over
   indexed fields, cached 1–5 minutes.
2. Partner dashboard (apps/partner): the same idea scoped to one vendor: sales, tickets, occupancy per show,
   upcoming shows, recent bookings.
3. Reports with CSV export (route handlers, streamed): sales by vendor, by venue, by movie/event, payouts,
   subscription invoices; filters for dates, city, vendor. Vendors get their own sales and payouts reports in the
   partner app. No customer contact data in vendor exports unless shareCustomerContact is on.
4. Notifications: Notification model (audience staff or vendor, type, title, link, read). Create them for: new
   vendor signup, list-your-show request, refund created, payout marked paid (to the vendor), subscription invoice
   issued (to the vendor). Bell with unread count in both consoles; list and mark read.

Manual checklist: make bookings at two vendors, check both dashboards and that each vendor only sees their own,
export reports from admin and partner, sign up a vendor and see the admin notification.
```
