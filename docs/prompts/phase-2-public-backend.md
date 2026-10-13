# Prompts: Public backend (areas 1–10)

Four prompts, run in order, each in a fresh Claude Code session (`/clear` first).
Each one plans first and waits for your OK. Review the plan, then say "go".
Tests are deferred for now: the prompts verify with lint, typecheck and build only, and you check the app by hand
from the checklist each prompt ends with.

| Prompt | Areas | Result |
|---|---|---|
| A | 1 Catalogue | Every public page reads from MongoDB |
| B | 2 Bookings, 3 Seat locking, 4 Payment, 6 Cancellation | Booking works end to end on Vercel |
| C | 5 QR ticket, 7 Reviews, 8 Leads, 9 Wishlist | Ticket and customer data saved |
| D | 10 Gift cards | Buy and redeem gift cards |

Defaults these prompts use (change them before running if you disagree):
- Business rules follow the **public** prototype: max 8 tickets per order, cancellation up to 20 minutes before the show,
  public coupon codes (SHOW50, UPIFIRST, HDFCWEEKEND, COMBOFREE, GOLDVIP), the public city list. Values live in a
  `settings` document so the admin app can change them later.
- Payment is **simulated** behind a gateway interface and works on Vercel production, labelled "Demo payment".
- Seed data comes from the current `packages/db/src/seed-catalog.ts` (what the UI shows today). The admin prototype's
  different catalogue is reconciled when the admin app is built.

---

## Prompt A: Catalogue in MongoDB

```text
Move the public catalogue from hard-coded data into MongoDB. Area 1 of the public backend
(docs/prompts/phase-2-public-backend.md).

Context: the public UI is complete and reads everything from packages/db/src/seed-catalog.ts through
packages/core/src/services (catalog.service, show.service, seat-map.service, pricing.service). Only auth and
account data are in MongoDB today. Priority is a working client demo on Vercel; keep security basic
(validation, atomic updates) and don't over-engineer.

Read first: CLAUDE.md, docs/roadmap.md, seed-catalog.ts, every service that imports it, the Zod schemas in
packages/schemas (movie, venue, event, city, offer, food, gift-card, stream, types/catalog), packages/db
(connect, models, scripts), and the pages/components that render catalogue data. Plan first and wait for my OK.
No new dependencies.

Requirements
1. Models in packages/db (one file each, registered in models/index.ts, indexes in the model file):
   City, Movie, Venue (cinemas, stadiums, other venues, with screens and their seat layouts embedded or as
   separate Screen/SeatLayout models: choose and explain), Event (one collection with kind: event | play |
   sport | activity), StreamTitle, Coupon, FoodItem, GiftCardDesign, Show, and a single Settings document
   (gstBps, convenienceFeeBps, maxTicketsPerOrder 8, cancellationCutoffMinutes 20, cancellationFeePaise 5000,
   seatHoldMinutes 10). Zod stays the source of truth for shapes; reuse the existing schemas.
   Slugs unique per collection; public URLs stay slug-based and unchanged.
2. Shows: today they are generated on the fly from each cinema's showTemplates. Store them as real Show documents
   (movieId or eventId, venueId, screen, startsAt as UTC Date, format, language, zone prices in paise).
   The demo must never run out of shows: add an idempotent "ensure shows for the next N days" step (upsert on a
   unique key such as venue + screen + startsAt) and run it either lazily from the showtimes query or from a
   Vercel Cron route protected by CRON_SECRET. Recommend one in the plan. Show IDs become ObjectIds: update
   showIdSchema and anything that parses the old composite ID, and make an old cart in sessionStorage fail
   gracefully (bump the cart storage version).
3. Seed: packages/db/scripts/seed.ts (pnpm db:seed). Idempotent upserts by slug/code, never drops or deletes.
   seed-catalog.ts becomes seed data used only by the script (move it next to the script); no service imports it.
4. Services in packages/core read from MongoDB with the same function signatures where possible, so pages barely
   change. pricing.service reads GST/fees/limits from Settings (cached per request) and coupons/food from the DB.
   Search (header search) queries the DB (a text index or simple case-insensitive prefix match is enough).
5. Caching: catalogue reads (lists, details) use "use cache" with cacheTag per collection and a sensible
   cacheLife; showtimes and anything time- or availability-dependent stays dynamic (Cache Components rules,
   CLAUDE.md §12). Export a revalidateCatalog(tag) helper so the admin app can trigger it later.
6. Seat maps keep their current look; seat layouts come from the DB. Sold/held seats are still the in-memory
   stand-in until Prompt B; leave that code alone except for the new show IDs.

Tests are deferred (CLAUDE.md §9 build-phase rule): don't write or run tests. Verify with pnpm lint,
pnpm typecheck and pnpm build only. If existing tests no longer compile because code they use was removed,
mark them it.skip with a one-line reason and list them in the report.

Run the seed against my Atlas database from .env.local only after I confirm. Don't click through the app
yourself: end with a short checklist of pages for me to check (home, movies, a movie, showtimes today and
tomorrow, an event, a play, sports, activities, stream, offers, search).

Docs: CLAUDE.md (models, seed command, Settings, show generation, stand-ins section), docs/roadmap.md.
Follow CLAUDE.md §10: work on main, don't commit; end with a summary and a suggested commit message.
```

---

## Prompt B: Real booking flow (bookings, seat locking, payment, cancellation)

```text
Make booking real: seat holds, saved bookings, simulated payment that works on Vercel, cancellation.
Areas 2, 3, 4 and 6 of docs/prompts/phase-2-public-backend.md. Prompt A (catalogue in MongoDB) is done.

Context: booking.service and seat-map.service keep bookings and sold seats in server memory, and placeDemoOrder
refuses to run in production, so booking fails on the Vercel production URL. The UI flow is
seats → food → checkout → payment → success/failure, and sign-in is required before payment.

Read first: CLAUDE.md (booking & seat-locking rules, pricing rules), docs/roadmap.md, booking.service,
seat-map.service, pricing.service, show.service, apps/web/src/app/(public)/_actions/booking.ts, the booking
pages and components (SeatSelector, StadiumMap, TierPicker, FoodSelector, CheckoutForm, PaymentPanel,
BookingsList, success/failure pages), stores/booking-cart.ts, and ../showBuzz_HTML seat-selection.html,
checkout.html, payment.html, bookings.html for behaviour. Plan first and wait for my OK. No new dependencies.

Decisions
- Payment: a PaymentGateway interface (createPayment, confirmPayment, refund) with a SimulatedGateway selected by
  env PAYMENT_PROVIDER=simulated (allowed in production until a real gateway is chosen; add to env schema and
  .env.example). Confirmation happens on the server, never trusted from the client. The payment page shows a
  clear "Demo payment" label and offers "Pay" and "Simulate failure".
- Rules come from the Settings document (max tickets, hold minutes, cancellation cutoff and fee).

Requirements
1. Seat holds (movies and seated venues): SeatHold model with a unique index on { showId, seatId } and a TTL
   index on expiresAt. Holding seats = insertMany(ordered: false); any duplicate-key failure releases what this
   request inserted and returns 409 SEAT_UNAVAILABLE with the taken seats. Never check-then-insert.
   Holds belong to the customer (or a guest hold token in an httpOnly cookie before sign-in: choose and explain).
   Changing the selection releases old holds. The seat map shows booked + held-by-others as unavailable.
   The existing countdown uses the real hold expiry; when it runs out the user is sent back to seat selection.
2. Quantity tiers (events, plays, activities, sport stands without seat numbers): capacity per tier on the show;
   reserve with a single conditional $inc (sold + held + qty <= capacity), release on expiry/cancel.
   Use the simplest design that cannot oversell.
3. Orders: placing an order (signed-in, requireCustomer) re-prices everything on the server (pricing.service,
   coupon validation, food), checks the holds are still the customer's and unexpired, and creates a Booking in
   status "pending_payment" with bookingCode SB-XXXXXX (unique index, retry on collision), amounts in paise,
   items, contact, userId.
4. Payment confirmation: in a MongoDB transaction, mark payment succeeded, booking "confirmed", convert holds into
   sold seats (or tier sold counts), and record a Payment document. Idempotent: confirming twice changes nothing.
   Failure: booking "payment_failed", holds released, redirect to /booking/failure with retry.
   Expired holds at confirmation → booking fails with a clear message, no charge recorded.
5. My bookings / success page: read from the Booking collection (owner only, 404 for others, as today).
6. Cancellation: allowed until cancellationCutoffMinutes before startsAt; refund = paid minus cancellation fee
   (never negative); transaction sets status "cancelled", frees seats/tier capacity, creates a Refund document via
   gateway.refund (simulated = immediately "processed"). Cancelling twice is a no-op.
7. Remove the in-memory booking and sold-seat stores and their stand-in notes.

Tests are deferred (CLAUDE.md §9 build-phase rule): don't write or run tests. Verify with pnpm lint,
pnpm typecheck and pnpm build only. Existing tests for the removed in-memory stores: mark them it.skip with a
one-line reason and list them in the report.

Don't click through the app yourself: end with a short checklist for me (book a movie, book an event, try the
same seat from two browsers, demo pay and simulate failure, cancel inside and outside the cutoff).
Docs: CLAUDE.md (booking flow, models, PAYMENT_PROVIDER, remove stand-ins), docs/openapi.yaml if you add
route handlers, docs/roadmap.md. Follow CLAUDE.md §10: work on main, don't commit; end with a summary and
a suggested commit message.
```

---

## Prompt C: QR ticket, reviews, leads, wishlist

```text
Finish the customer-facing data: real M-ticket QR, reviews, leads and wishlist in MongoDB.
Areas 5, 7, 8 and 9 of docs/prompts/phase-2-public-backend.md. Prompts A and B are done.

Read first: CLAUDE.md, docs/roadmap.md, TicketCode.tsx, TicketActions.tsx, the success page, BookingsList,
review.service, ReviewDialog and the movie details page, lead.service and LeadForms (list-your-show,
corporate, contact), stores/wishlist.ts, WishlistButton, ProfileDashboard (wishlist tab), and the prototype
booking-success.html, bookings.html, movie-details.html, profile.html. Plan first and wait for my OK.

Approved dependency: qrcode (+ @types/qrcode if needed). Nothing else.

Requirements
1. QR ticket: payload = bookingCode + showId + seats/tiers + issuedAt, signed with HMAC-SHA256 using
   QR_SIGNING_SECRET (add to env schema and .env.example; generate a value into .env.local without printing it).
   Generate the QR server-side as SVG and show it on the success page and in My bookings (printable layout as in
   the prototype). Add verifyTicketPayload() in packages/core for the admin scan-qr screen later; cancelled
   bookings must not verify as valid.
2. Reviews: Review model (movieId, userId, rating 1–10 or the prototype's scale, text, status "published"
   for now, timestamps), unique { movieId, userId } (one review per customer per movie; submitting again updates
   it, as already decided). Store the rating aggregate (average, count) on the movie, updated atomically, and
   show it on the movie page and cards. Author name from the session snapshot.
3. Leads: Lead model (type contact | corporate | show_submission, the form fields, status "new", ipPrefix,
   timestamps). Per-IP rate limit with the existing consumeRateLimit and a hidden honeypot field for spam.
   Nothing reads them yet except a service function the admin app will use.
4. Wishlist: Wishlist in MongoDB per user (items referenced by kind + id, unique per user + item). Signed-out
   visitors keep the current localStorage wishlist; on sign-in merge it into the account once and clear the
   local copy. The heart buttons and the profile wishlist tab use the server copy when signed in (optimistic
   UI, revert on failure).
5. Remove the in-memory review and lead stores and their stand-in notes.

Tests are deferred (CLAUDE.md §9 build-phase rule): don't write or run tests. Verify with pnpm lint,
pnpm typecheck and pnpm build only. Existing tests for removed in-memory stores: mark them it.skip with a
one-line reason and list them in the report.

Don't click through the app yourself: end with a short checklist for me (ticket QR on success + My bookings,
write and edit a review, submit each lead form, wishlist signed out → sign in → items still there).
Docs: CLAUDE.md, docs/roadmap.md. Follow CLAUDE.md §10: work on main, don't commit; end with a summary and a
suggested commit message.
```

---

## Prompt D: Gift cards

```text
Make gift cards real: purchase creates a card with a code and balance, and customers can pay with it.
Area 10 of docs/prompts/phase-2-public-backend.md. Prompts A–C are done.

Read first: CLAUDE.md, docs/roadmap.md, GiftCardDesigner.tsx, the gift-cards page, the checkout/payment flow
from Prompt B (gift card purchases already go through checkout as kind "gift-card"), pricing.service,
schemas/gift-card.ts, GIFT_CARD_LIMITS in constants, and ../showBuzz_HTML/gift-cards.html, checkout.html.
Plan first and wait for my OK. No new dependencies.

Requirements
1. GiftCard model: code (unguessable, e.g. 16 chars grouped, unique index), design, amount and balance in paise,
   purchaserUserId, recipient name/email/message, status active | redeemed | expired | cancelled, expiresAt
   (12 months, confirm in plan), transactions[] (purchase, redeem, refund) or a separate ledger: choose and explain.
2. Purchase: after the (simulated) payment for a gift-card order is confirmed, create the card in the same
   transaction as the booking/payment. Show the code on the success page and in My bookings. No email yet
   (no provider): show it on screen and note it as a stand-in.
3. Redeem at checkout: "Apply gift card" on the checkout page. The server checks code, status, expiry and balance,
   and applies min(balance, amount due). Deduct the balance atomically (conditional $inc so two orders can't
   spend the same balance) only when the payment is confirmed; the rest is paid with the simulated gateway, or
   nothing if the card covers everything. Rate-limit code attempts per user and per IP (guessing protection).
4. Cancellation of a booking paid partly by gift card returns that part to the card balance.
5. A "My gift cards" section in the profile: purchased cards with balance and status.

Tests are deferred (CLAUDE.md §9 build-phase rule): don't write or run tests. Verify with pnpm lint,
pnpm typecheck and pnpm build only.

Don't click through the app yourself: end with a short checklist for me (buy a card, apply it to a movie
booking with partial and full cover, cancel, check the balance). Docs: CLAUDE.md, docs/roadmap.md. Follow CLAUDE.md §10: work on main, don't commit;
end with a summary and a suggested commit message.
```
