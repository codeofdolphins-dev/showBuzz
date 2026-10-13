# Prompts: Admin console (apps/admin)

Already built: staff login, roles and permissions, console shell (menu, Ctrl+K, topbar), profile, Super Admin
password reset. Every other menu page shows "Coming soon". These 8 prompts build the rest, one sidebar section
each (about 45 pages, roughly 6 per prompt).

| # | Prompt | Pages | Needs first |
|---|---|---|---|
| 1 | Admin kit + master data + staff | shared table/form kit, web cache refresh, activity log, cities, languages, genres, settings, staff, roles | catalogue in MongoDB (public A) |
| 2 | Catalogue | movies, events, plays, sports, activities, streaming | 1 |
| 3 | Venues, seating, shows | cinemas, venues, screens, seat layout designer, seat management, show scheduling | 2 |
| 4 | Box office | bookings, booking details, new booking (POS), scan QR, customers, payments, refunds | 3 + public B and C |
| 5 | Partners | organisers, settlements (payouts), list-your-show requests, corporate/contact leads | 4 + public C |
| 6 | Marketing | banners, offers, coupons, gift cards, reviews | 1 + public C and D |
| 7 | Content & system | website pages, SEO, media library, backup | 1 |
| 8 | Insights | dashboard, reports + CSV, analytics, notifications | 4 |

**Run order:** finish the public prompt that's in progress first. Two Claude Code sessions editing the same
packages at once will overwrite each other's work. A good order: public B → admin 1 → admin 2 → admin 3 →
public C → public D → admin 4 → 5 → 6 → 7 → 8.

Paste each prompt into a fresh session (`/clear` first). Every prompt starts by pointing at the shared rules
below, so the prompts stay short.

---

## Shared rules (every admin prompt follows these)

```text
Shared rules for admin prompts (docs/prompts/phase-3-admin.md):
- Read first: CLAUDE.md, the prototype pages named in the prompt (../showBuzz_HTML/admin/<page>.html plus
  -form / -details variants and admin/assets/js/*.js for behaviour and sample fields), and the existing admin code:
  apps/admin/src/app/(console)/layout.tsx, components/console/PageParts.tsx, components/ui/form.tsx,
  lib/nav.ts, the users page, and packages/core/src/auth/admin/current-staff.ts. Follow their patterns.
- Plan first (pages, models/fields, services, open questions) and wait for my OK.
- Reproduce the prototype's layout and fields with real data. Product name is "ShowBuzz Admin". If a prototype
  feature needs something undecided (email/SMS provider, media storage, payment gateway), build the UI with a
  clearly labelled stand-in and note it in CLAUDE.md §12.
- Every page: requireStaffPage(path) + the menu item's "<resource>:read" permission (NoAccess otherwise).
  Every mutation is a Server Action in apps/admin/src/app/_actions/ that checks requirePermission("<resource>:write")
  (or the specific one), validates with Zod from packages/schemas, calls a service in
  packages/core/src/services/admin/, and records logActivity(...) (from prompt 1). Hide buttons the staff member
  can't use, but always check on the server.
- Lists: server-side pagination, search, sort and filters driven by URL search params; empty, loading and error
  states. Forms: React Hook Form + the same Zod schema as the server.
- Prefer status changes (inactive / archived / cancelled) over hard deletes for anything other records reference.
  Hard delete only for unreferenced records, behind a confirm dialog.
- After changing anything the public site shows, call revalidateWeb(tags) (from prompt 1) so showbuzz.com updates.
- Money in paise, dates stored UTC and shown in IST, as everywhere else.
- Tests are deferred (CLAUDE.md §9): don't write or run tests; verify with pnpm lint, pnpm typecheck and pnpm build.
  Don't click through the app yourself; end with a short manual checklist for me.
- Don't install or download anything without asking me first (say what, from where, how big).
- Work on main, don't commit. Update CLAUDE.md and docs/roadmap.md, replace "Coming soon" for the pages you
  built, and end with a summary and a suggested commit message.
```

---

## Admin 1: Admin kit, master data, settings, staff and roles

```text
Admin prompt 1 of 8. Follow the shared rules in docs/prompts/phase-3-admin.md (read that file first).

Build the shared admin building blocks, then use them for the simple system screens.
Prototype pages: cities, languages, genres, settings, users, roles, activity-log.

1. Admin kit (apps/admin/src/components/): DataTable (columns, server pagination/search/sort via search params,
   row actions, bulk select where the prototype has it), filter bar, form field set (text, number, select,
   multi-select, toggle, date/time in IST, money in rupees ↔ paise, image URL with preview), confirm dialog,
   status badge, toasts, page header with breadcrumbs. Match the prototype's look. Keep it small; no new
   dependencies.
2. Web cache refresh: a POST route in apps/web (e.g. /api/internal/revalidate) protected by a shared
   REVALIDATE_SECRET (constant-time compare) that calls revalidateCatalog for the given tags, and
   revalidateWeb(tags) in packages/core used by admin actions (best effort: log a failure, never block the
   admin save). Add REVALIDATE_SECRET to both apps' env schema, .env.example and turbo.json; generate a value
   into both .env.local files without printing it.
3. Activity log: ActivityLog model (staffId, staff name, action, resource, resourceId, summary, changed field
   names (never secrets), ipPrefix, createdAt; index on createdAt and resource) + logActivity() service +
   the Activity Logs page (filter by staff, resource, date).
4. Master data: Cities CRUD (the public city picker reads cities; popular flag, sort order, active),
   Languages and Genres as new collections seeded from the values the catalogue already uses (they become the
   option lists for catalogue forms; movies keep storing names, no data migration).
5. Platform Settings page: edit the Settings document (GST, convenience fee, max tickets per order, cancellation
   cutoff and fee, seat hold minutes) plus any other prototype settings fields worth keeping (list them in the
   plan; skip ones that need undecided providers).
6. Staff & Operators: list, create (temporary password shown once, like the reset), edit name/role, disable /
   enable (disabling signs them out everywhere). Keep the existing Super Admin password reset. A staff member
   can't disable themselves or remove the last active Super Admin.
7. Role Permissions: list roles, create/edit custom roles with the permission matrix (grouped by menu section),
   delete unused custom roles. System roles: Super Admin is locked; other system roles can be edited but not
   deleted.

Manual checklist at the end should cover: add a city and see it in the public city picker, change GST and see
checkout totals change, create a staff member with a custom role and confirm their menu only shows what the
role allows.
```

---

## Admin 2: Catalogue

```text
Admin prompt 2 of 8. Follow the shared rules in docs/prompts/phase-3-admin.md (read that file first).
Prompt 1 (admin kit, revalidateWeb, activity log, master data) is done.

Build the Catalogue section. Prototype pages: movies, movie-form, events, event-form, plays, sports,
activities, streaming (plays/sports/activities/streaming have no form page in the prototype: reuse the event
form with the right kind and fields).
Models already exist in packages/db (Movie, Event with kind, StreamTitle). Read their toX() mappers and the
public pages that show them so every field the public site renders is editable.

1. Movies: list (search, filter by status, language, genre; poster thumbnail), create/edit (all fields the public
   movie page uses: titles, slug (auto from title, editable, unique), synopsis, duration, certificate, languages,
   genres (from master data), formats, release date, status now-showing / coming-soon / archived, poster and
   backdrop URLs, trailer URL, cast and crew as repeatable rows, editorial reviews), details view, archive.
   Changing status to now-showing makes the movie appear in showtimes (show generation already handles that).
2. Events, plays, sports, activities: one shared form driven by kind (title, slug, category, description,
   venue (select from venues, or venue name until prompt 3 adds venue CRUD), schedule dates in IST, ticket tiers
   with price in rupees and capacity, images, organiser name, status). Sports keep their stadium show link.
3. Online streams: StreamTitle CRUD (rent/buy prices, availability), even though public streaming checkout is
   still "coming soon".
4. Every save calls revalidateWeb with the right catalogue tags, and is written to the activity log.

Manual checklist: create a movie as now-showing and find it on the public home page and in showtimes; edit an
event's tier price and see it on the public event page; archive a movie and confirm it disappears publicly.
```

---

## Admin 3: Venues, seating and show scheduling

```text
Admin prompt 3 of 8. Follow the shared rules in docs/prompts/phase-3-admin.md (read that file first).
Prompts 1 and 2 are done.

Build "Venues & Seating" and "Show Scheduling". Prototype pages: cinemas, cinema-form, venues, venue-form,
screens, seat-layout, seat-management, shows, show-form, and admin/assets/js/seats.js for the designer.
Venue model: screens and seat layouts are embedded in the venue (CLAUDE.md §7); cinemas also have showTemplates.
Shows are generated from templates by ensureMovieShows (packages/db/src/shows.ts).

1. Cinemas & multiplexes and Venues & stadiums: CRUD (name, slug, city, address, amenities, cancellation note,
   status) with kind cinema | stadium | venue.
2. Screens & auditoriums: per venue, add/edit screens (name, layout type, formats).
3. Seat Layout Designer: build the prototype's designer without new dependencies (click/drag-select on a grid
   is enough; no drag-and-drop library): rows and seat counts per zone, aisles, zone assignment (Recliner,
   Executive, Premium, Regular, VIP, Wheelchair), blocked seats, zone prices. Saving a layout must not change
   seats that are already sold for future shows: if a change would remove or move a sold seat, refuse with a
   clear list of affected shows.
4. Seat Management & Holds: pick a show, see its live seat map (sold, held, blocked, free) and active holds;
   block/unblock seats for that show and release a hold manually.
5. Show Scheduling: the cinema's daily templates are edited in the cinema form (they keep driving automatic
   generation for the demo). The Shows page lists shows (filter by date, venue, movie/event), lets staff add a
   one-off show, change price/format/language, and cancel a show (only if nothing is sold; otherwise tell them
   to refund first). Prevent overlapping shows on the same screen (start + movie duration + cleaning buffer from
   settings or a 15-minute default).
6. Every save calls revalidateWeb where the public site is affected, and is logged.

Manual checklist: create a cinema with a screen and layout, add a template slot and see showtimes appear
publicly; block a seat and see it unavailable on the public seat map; try to cancel a show with sold seats.
```

---

## Admin 4: Box office

```text
Admin prompt 4 of 8. Follow the shared rules in docs/prompts/phase-3-admin.md (read that file first).
Prompts 1–3 and public prompts B (bookings, holds, simulated payment, refunds) and C (signed QR tickets) are done.

Build the box office screens on the existing Booking, Payment, Refund, SeatHold models and services; reuse the
public booking services rather than duplicating rules.
Prototype pages: bookings, booking-details, booking-form, scan-qr, customers, customer-details, payments, refunds.

1. Bookings CRM: list (search by booking code, phone, email; filter by date, status, venue, movie/event),
   details (items, seats, amounts breakdown, payment, refunds, customer, check-in status, timeline), and
   staff actions: cancel with refund (same rules as the customer cancel, with an override reason for
   cancellation after the cutoff, permission refunds:approve), resend ticket (stand-in: shows the ticket link).
2. New Booking (POS): staff picks show → seats/tiers → optional customer phone/email → payment method
   "counter cash" or "counter UPI" (recorded, no gateway) → confirmed booking with the same QR ticket. Uses the
   same hold and pricing services.
3. Scan QR Tickets: camera scanning with the browser BarcodeDetector API where available, plus manual entry of
   the code or booking ID as fallback (no new dependency; ask me if you think a scanning library is needed).
   Verify the signed payload (verifyTicketPayload), show booking details, and mark checked-in once (idempotent:
   a second scan shows "already checked in at ..."). Allow camera for the admin app in Permissions-Policy
   (camera=(self)) only.
4. Customers database: list (search, filter by status), details (profile, bookings, total spent, sessions count),
   block / unblock (blocking signs them out on the public site).
5. Payment Gateway: payments list with filters and status; clearly labelled "Simulated gateway" until a real one
   is chosen.
6. Refund Requests: list refunds (from cancellations), filters, details; approve/reject flow only if the current
   refund model has a pending state, otherwise read-only (say which in the plan).

Manual checklist: book on the public site, find the booking in the CRM, scan or enter its QR code twice,
cancel it from admin and see the refund; make a POS booking; block a customer and confirm they're signed out.
```

---

## Admin 5: Partners (organisers, payouts, requests and leads)

```text
Admin prompt 5 of 8. Follow the shared rules in docs/prompts/phase-3-admin.md (read that file first).
Prompts 1–4 and public prompt C (leads saved in MongoDB) are done.

Prototype pages: organisers, organiser-details, settlements, list-your-show.

1. Event Organisers: Organiser model and CRUD (company, contact person, phone, email, GST number, bank details
   for payouts (store only what the prototype shows; mask account numbers in lists), commission % , status).
   Link events to an organiser (add organiserId to the event form from prompt 2).
2. List Your Show requests: list the show_submission leads with status new → contacted → approved / rejected,
   notes, and "Approve" that creates the organiser (prefilled) so staff can then create the event.
   Add tabs on the same page for corporate and contact leads (status + notes), since the menu has no
   separate page for them.
3. Organiser Payouts (settlements): for an organiser and a date range, compute gross sales of their confirmed
   bookings, minus refunds, minus commission (and GST on commission if the prototype shows it) = payout.
   Create a Settlement record (period, amounts, status pending → paid with a reference number entered by
   staff). A booking can only be in one settlement. Permission settlements:write.

Manual checklist: submit "List your show" publicly, approve it in admin, create an event for that organiser,
book it publicly, run a settlement and mark it paid.
```

---

## Admin 6: Marketing

```text
Admin prompt 6 of 8. Follow the shared rules in docs/prompts/phase-3-admin.md (read that file first).
Prompt 1 and public prompts C (reviews) and D (gift cards) are done.

Prototype pages: banners, offers, coupons, gift-cards, reviews.

1. Marketing Banners: Banner model (title, image URL, link, placement (home hero, others the public site has),
   city or all cities, start/end dates, sort order, active). Reorder with up/down buttons (no drag-and-drop
   dependency). Switch the public home hero carousel to read active banners from the DB (fall back to the
   current content if none), with a cache tag revalidated from admin.
2. Offers & Bank Deals: the public /offers page content as data (Offer model if offers aren't already stored;
   check the coupons/offer seed first) with CRUD.
3. Coupons & Promos: CRUD on the existing Coupon model (code unique uppercase, percent or flat, max discount,
   min order, validity dates, usage limits per user and total, active). Show usage count from bookings.
   Public checkout must respect the new limits.
4. Gift Cards: list cards (code masked except last 4, balance, status, purchaser), details with the
   transaction ledger, cancel a card, and issue a complimentary card (permission gift-cards:write).
5. Customer Reviews: list with filters (movie, rating, status), hide / publish (moderation status); hiding
   or publishing updates the movie's rating aggregate atomically.

Manual checklist: add a home banner and see it on showbuzz.com, create a coupon with a usage limit and use it
past the limit, hide a review and see the movie rating change, cancel a gift card and try to use it.
```

---

## Admin 7: Content and system

```text
Admin prompt 7 of 8. Follow the shared rules in docs/prompts/phase-3-admin.md (read that file first).
Prompt 1 is done.

Prototype pages: pages, seo, media-library, backup.

1. Website Pages: the public About, Privacy, Terms and FAQ content as editable data (Page model: slug, title,
   sections or body, status, updatedBy). The prototype used Quill, but the editor is undecided: propose in the
   plan between a plain structured editor (headings + paragraphs + lists as fields, no dependency) and a
   rich-text library (ask before installing). Public pages read from the DB with cache tags, falling back to
   the current static content.
2. SEO & Meta Tags: SeoMeta per public route or catalogue item (title, description, Open Graph image,
   noindex). Public generateMetadata reads it when present, otherwise keeps today's defaults.
3. Media Library: storage is undecided, so the library stores image URLs (with title, alt text, tags, where
   used) and lets other forms pick from it. No uploads yet; note it as a stand-in.
4. Backup & Restore: Super Admin only. Export selected collections as a JSON download (exclude sessions,
   password and OTP hashes, rate limits). Restore is out of scope for now (show the prototype UI disabled with
   a note); Atlas backups are the real safety net.

Manual checklist: edit the Terms page and see it publicly, set an SEO title for a movie and check the page
title, add a media item and pick it in the movie form, export a backup and confirm no secrets are in it.
```

---

## Admin 8: Insights (dashboard, reports, analytics, notifications)

```text
Admin prompt 8 of 8. Follow the shared rules in docs/prompts/phase-3-admin.md (read that file first).
Prompts 1–4 are done (bookings, payments, refunds and customers exist).

Prototype pages: dashboard, reports, analytics, notifications.
Candidate dependency: chart.js + react-chartjs-2 (the prototype uses Chart.js). Ask me before installing.

1. Dashboard: replace the labelled sample figures with real numbers for a selectable period (today, 7 days,
   30 days): gross sales, tickets sold, bookings, cancellations/refunds, occupancy, top movies/events, sales by
   city/venue, recent bookings. MongoDB aggregations in a dashboard service, indexed fields only; cache each
   query for a short time (1–5 minutes).
2. Sales Reports & Export: the prototype's report types with filters (date range, city, venue, movie/event,
   payment method) and CSV export streamed from a route handler (permission reports:read; no PII beyond what
   the report needs).
3. Audience Analytics: the prototype's charts that can be computed from real data (new vs returning customers,
   bookings by hour/day, language/genre mix, average order value). Skip charts that need data we don't collect
   and list them in the report.
4. Notifications: Notification model for staff (type, title, link, read state, per staff or per permission).
   Create them on new booking above a threshold, refund created, new list-your-show request, new lead.
   Topbar bell shows the unread count; the page lists and marks read.

Manual checklist: make a few public bookings and cancellations, check the dashboard numbers and charts,
export a CSV and open it, submit a lead and see the notification.
```
