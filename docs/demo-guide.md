# ShowBuzz client demo guide

How to prepare and run a demo of the three sites. Everything below works with the current stand-ins: payments are
simulated, sign-in codes are shown on screen (local) or written to the server log (Vercel), and no email/SMS is sent.

| Site           | Local                 | Production                   | Who                           |
| -------------- | --------------------- | ---------------------------- | ----------------------------- |
| Public site    | http://localhost:3000 | https://showbuzz.com         | Customers                     |
| Admin console  | http://localhost:3001 | https://admin.showbuzz.com   | ShowBuzz staff (super-admin)  |
| Partner portal | http://localhost:3002 | https://partner.showbuzz.com | Vendors (cinemas, organisers) |

## 1. Prepare (once per database, ~10 minutes)

Run from the repo root with `apps/web/.env.local` pointing at the demo database:

```bash
pnpm db:sync-indexes        # indexes and TTLs for every collection (notifications, media, analytics)
pnpm db:seed                # catalogue, 3 demo vendors, venues, events, settings, shows for the next 7 days
pnpm db:seed-roles          # the 5 staff roles (Super Admin gets every permission)
pnpm db:create-admin --email demo@showbuzz.com --name "Demo Admin"   # prompts for a password (12+ chars)
pnpm db:seed-demo-vendors   # partner logins for the demo vendors (refuses to run in production)
```

Demo vendor logins (password `12345678`, dev databases only):

| Login                 | Vendor                       | Billing        | What it sells                                                  |
| --------------------- | ---------------------------- | -------------- | -------------------------------------------------------------- |
| screens@showbuzz.test | Kolkata Screens Pvt Ltd      | Commission 10% | Cinemas (PVR INOX Quest, Cinépolis Acropolis, PVR ICON Mumbai) |
| palace@showbuzz.test  | Bengal Picture Palace LLP    | Subscription   | Cinemas (INOX Insignia, Miraj)                                 |
| events@showbuzz.test  | Festive Nights Entertainment | Commission 12% | Every event, play, sport and activity                          |

## 2. Before each demo (2 minutes)

1. Admin → **Backup** → **Top up demo shows**, so every demo cinema has showtimes for the next 7 days.
2. Open showbuzz.com once (warms the cache) and pick **Kolkata** as the city.
3. Make one or two bookings in advance so the dashboards, reports and analytics aren't empty (step 3 below).
4. Optional: upload two or three images in Admin → **Media Library** and use one on a home banner.

## 3. Suggested walkthrough (25–30 minutes)

**Customer (public site)**

1. Home: hero banners, now-showing movies, events. Switch city.
2. Movie page → pick a date and a cinema showtime → seat map (live holds, categories, prices).
3. Food step → checkout (sign in with mobile; the code appears on screen locally, or in the Vercel log) → apply
   coupon `SHOW50` → payment page → **Pay** (simulated) → ticket with QR.
4. Events / plays / sports: book passes or stadium seats the same way.
5. Account: My Bookings (QR, cancel within the vendor's policy), profile, gift cards, wishlist, review a movie.

**Vendor (partner portal, `screens@showbuzz.test`)**

1. Dashboard: today / 7 / 30 days sales, occupancy per show, upcoming shows, recent bookings (only this vendor's).
2. Bookings: the booking just made (no customer contact unless ShowBuzz shares it) → **Scan Tickets** with the QR or
   the code `SB-…` (second scan says "already checked in").
3. Box office: sell 2 seats at the counter (cash/UPI) and print the ticket.
4. Venues → seat layout designer; Shows → schedule a show (overlap check); Food; Offers & Coupons; Cancellation Policy.
5. Earnings and **Reports** → Export CSV.

**ShowBuzz admin (super-admin)**

1. Dashboard: gross sales, platform revenue (fees + commission + subscriptions), top vendors and titles, cities.
2. Notifications bell: refunds, list-your-show requests, vendor signups.
3. Vendors: KYC with documents, billing terms, suspend/reactivate; Payouts (preview → create → mark paid, the vendor
   is notified); Subscription invoices (generate the month).
4. Events / Plays / Sports / Activities: every vendor's listings with sales; **Take down** one with a reason (it
   disappears from showbuzz.com and the vendor sees why), then **Restore**.
5. Bookings oversight, Customers, Reviews, Banners, Coupons, Gift cards, Pages & SEO, Online Streams, Media Library.
6. Reports (CSV), Analytics (peak hours, devices, lead time, returning customers), Activity log, Staff & roles,
   Backup export.

**Vendor signup (optional, 3 minutes):** partner `/signup` → mobile code → onboarding (business → GSTIN/PAN → bank →
documents → submit). The admin bell shows "New vendor signup".

## 4. What to say about stand-ins

| Area           | In the demo                                                     | Before launch               |
| -------------- | --------------------------------------------------------------- | --------------------------- |
| Payments       | Simulated gateway ("Pay" / "Simulate failure"), instant refunds | Razorpay or Cashfree        |
| OTP            | Code on screen (local) or in the server log                     | SMS provider                |
| Email          | None (temporary passwords shown on screen once)                 | Email provider              |
| Media          | Images stored in MongoDB (Media Library), Unsplash URLs         | S3 / Vercel Blob            |
| Streaming      | Titles listed, Rent/Buy says "coming soon"                      | Streaming checkout + player |
| Social sign-in | Google/Apple buttons say "coming soon"                          | OAuth                       |

## 5. If something looks empty

- No showtimes for a cinema → Admin → Backup → **Top up demo shows**.
- Dashboard or analytics empty → make a booking; figures refresh within 1–5 minutes.
- A listing missing on the public site → it may be switched off by its vendor or taken down by staff (admin list
  shows the status).
- An image doesn't show → image fields accept only images.unsplash.com URLs or Media Library paths (`/media/…`).
