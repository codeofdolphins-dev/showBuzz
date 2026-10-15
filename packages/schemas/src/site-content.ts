import { z } from "zod";
import { hostedImageUrlSchema, imageUrlSchema } from "./common";
import { CANCELLATION_CUTOFF_MINUTES } from "./constants";

/**
 * Editable website pages and SEO (prompt 7). Pages are structured fields (headings, paragraphs, bullet lists, FAQ
 * pairs), not rich text, so no editor dependency is needed and the public pages keep their design. DEFAULT_PAGES is
 * the content the site shipped with: the seed writes it once, and the public pages fall back to it whenever the
 * stored page is missing, unpublished or invalid.
 */

export const SITE_PAGE_SLUGS = ["about", "privacy", "terms", "faq"] as const;
export const sitePageSlugSchema = z.enum(SITE_PAGE_SLUGS);
export type SitePageSlug = z.infer<typeof sitePageSlugSchema>;

export const SITE_PAGE_META: Record<SitePageSlug, { name: string; path: string }> = {
  about: { name: "About ShowBuzz", path: "/about" },
  privacy: { name: "Privacy Policy", path: "/privacy" },
  terms: { name: "Terms & Conditions", path: "/terms" },
  faq: { name: "FAQs", path: "/faq" },
};

const line = (what: string, max: number) => z.string().trim().min(1, `Enter the ${what}`).max(max);
const paragraph = z.string().trim().min(1, "Write the paragraph or remove it").max(2000);
const bullet = z.string().trim().min(1, "Write the item or remove it").max(300);

export const legalSectionSchema = z.object({
  heading: line("heading", 120),
  paragraphs: z.array(paragraph).max(10, "Up to 10 paragraphs"),
  bullets: z.array(bullet).max(20, "Up to 20 list items"),
});

/** Privacy and Terms. */
export const legalContentSchema = z.object({
  title: line("page title", 120),
  sections: z.array(legalSectionSchema).min(1, "Add at least one section").max(30, "Up to 30 sections"),
});

export const faqContentSchema = z.object({
  eyebrow: z.string().trim().max(40),
  title: line("page title", 120),
  intro: z.string().trim().max(300),
  items: z
    .array(z.object({ question: line("question", 300), answer: line("answer", 2000) }))
    .min(1, "Add at least one question")
    .max(50, "Up to 50 questions"),
});

export const aboutContentSchema = z.object({
  eyebrow: z.string().trim().max(40),
  title: line("headline", 160),
  intro: z.string().trim().max(600),
  /** images.unsplash.com or the Media Library (next/image allows only those). */
  imageUrl: hostedImageUrlSchema,
  cards: z
    .array(z.object({ title: line("card title", 80), text: line("card text", 400) }))
    .min(1, "Add at least one card")
    .max(6, "Up to 6 cards"),
});

export const PAGE_CONTENT_SCHEMAS = {
  about: aboutContentSchema,
  privacy: legalContentSchema,
  terms: legalContentSchema,
  faq: faqContentSchema,
} as const;

export type LegalContent = z.infer<typeof legalContentSchema>;
export type FaqContent = z.infer<typeof faqContentSchema>;
export type AboutContent = z.infer<typeof aboutContentSchema>;
export type PageContent<S extends SitePageSlug> = z.infer<(typeof PAGE_CONTENT_SCHEMAS)[S]>;

export const pageStatusSchema = z.enum(["published", "draft"]);
export type PageStatus = z.infer<typeof pageStatusSchema>;

/** One page as the public site renders it: stored content when published and valid, else the default. */
export interface SitePageView<S extends SitePageSlug> {
  content: PageContent<S>;
  /** ISO time of the last save (absent for the built-in default). */
  updatedAt?: string;
}

const legal = (heading: string, body: string) => ({ heading, paragraphs: [body], bullets: [] });

export const DEFAULT_PAGES: { [S in SitePageSlug]: PageContent<S> } = {
  about: {
    eyebrow: "Our Mission",
    title: "Bringing Stories, Music & Experiences to Life",
    intro:
      "ShowBuzz was founded with a singular ambition: to build India's smoothest, most visually inspiring entertainment ticketing platform.",
    imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600&auto=format&fit=crop&q=80",
    cards: [
      {
        title: "Delightful Experience",
        text: "We design interfaces that feel fast, intuitive, and enjoyable from the moment you explore a trailer to the second you scan your ticket.",
      },
      {
        title: "Unmatched Speed",
        text: "Infrastructure built to handle massive ticket demand during stadium cricket finals and viral concert drops.",
      },
      {
        title: "Empowering Organisers",
        text: "Giving independent artists, playwrights, comedians, and cinema exhibitors world-class discovery, promotion, and analytics tools.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      legal(
        "Information We Collect",
        "ShowBuzz Entertainment Pvt. Ltd. collects information that you provide when registering an account, booking tickets, applying discount coupons, or using our apps and website. This includes your name, email address, mobile number, location preference, and payment transaction references.",
      ),
      legal(
        "How We Use Your Data",
        "We use your information to generate and deliver your digital M-tickets, process payments through authorised banking gateways, send showtime reminders, and offer personalised recommendations based on your preferences.",
      ),
      legal(
        "Payment Information & Security",
        "ShowBuzz does not store raw card numbers or banking PINs. Payments are processed by PCI-DSS compliant gateways in line with Reserve Bank of India tokenisation mandates.",
      ),
      legal(
        "Cookies & Local Storage",
        "We use secure cookies to keep you signed in, and your browser's local storage to remember preferences such as your selected city and wishlist.",
      ),
    ],
  },
  terms: {
    title: "Terms & Conditions of Use",
    sections: [
      legal(
        "Acceptance of Terms",
        "By accessing or using the ShowBuzz website, applications, or ticket booking services, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the service.",
      ),
      legal(
        "Ticket Booking & Admission",
        "ShowBuzz acts as a digital ticketing facilitator between patrons and cinema exhibitors or event organisers. Entry is subject to the venue's age classification (e.g. 'A' certificate movies require 18+ ID proof) and security policies.",
      ),
      legal(
        "Cancellation & Refund Policy",
        `Where cancellation is available, ticket holders may cancel up to ${CANCELLATION_CUTOFF_MINUTES} minutes before showtime from the dashboard. The amount paid, less a ₹50 cancellation fee, is credited back to the source account within 24-48 hours.`,
      ),
      legal(
        "Promotional Coupons & Offers",
        "Coupons (e.g. SHOW50, UPIFIRST) are subject to minimum order criteria, expiry dates and usage limits per account. ShowBuzz may withdraw promotional offers without prior notice.",
      ),
    ],
  },
  faq: {
    eyebrow: "Help Center",
    title: "Frequently Asked Questions",
    intro: "Find instant answers to common questions about your entertainment tickets.",
    items: [
      {
        question: "How do I access and use my digital M-Ticket at the cinema or event?",
        answer:
          'Once your booking is confirmed, a digital M-ticket with a unique entry code is generated. Open it anytime from "My Bookings", or via the link sent to your email. Show the code at the cinema or gate entry scanner; no paper printout needed.',
      },
      {
        question: "What is the ticket cancellation policy and when do I get a refund?",
        answer: `Most cinemas and select events support cancellation up to ${CANCELLATION_CUTOFF_MINUTES} minutes before the scheduled showtime. Go to "My Bookings", choose the booking and select "Cancel & Refund". The amount paid, less a ₹50 cancellation fee, is refunded to your original payment method within 24-48 business hours.`,
      },
      {
        question: "How do discount coupon codes like SHOW50 work?",
        answer:
          'On the checkout page, enter your promo code and tap "Apply". If the minimum purchase conditions are met, the discount is deducted from the payable total. First-time users can use SHOW50 for 50% off (up to ₹150) on bookings of ₹300 or more.',
      },
      {
        question: "Can I pre-order Food & Beverages and have them delivered to my seat?",
        answer:
          "Yes. When booking cinema tickets you can add popcorn, nachos, combos, burgers and drinks. In luxury auditoriums like INOX Insignia, snacks are served right at your recliner.",
      },
      {
        question: "What payment methods are supported?",
        answer:
          "UPI (Google Pay, PhonePe, Paytm, BHIM), major credit and debit cards (Visa, Mastercard, RuPay, Amex), net banking, mobile wallets and ShowBuzz e-gift cards. Card details are entered on our payment partner's secure page and are never stored by ShowBuzz.",
      },
    ],
  },
};

// ---------------------------------------------------------------------------------------------------------------
// SEO

/** Site-wide defaults (prototype seo.html "Global Title Tag" / "Global Meta Description"). */
export const seoGlobalSchema = z.object({
  title: line("default title", 70).max(70, "Keep it under 70 characters"),
  description: line("default description", 300),
});
export type SeoGlobal = z.infer<typeof seoGlobalSchema>;

export const SEO_GLOBAL_DEFAULTS: SeoGlobal = {
  title: "ShowBuzz - Movie Tickets, Concerts, Plays, Sports & Activities",
  description:
    "ShowBuzz is India's entertainment booking platform. Book movie tickets, IMAX shows, concerts, live theatre and T20 cricket matches.",
};

/** A path on showbuzz.com: "/", "/movies", "/movies/<slug>", "/events/<slug>", ... (no query, no trailing slash). */
export const seoPathSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .regex(/^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/, "Use a site path like /movies or /movies/<slug>");

/** Overrides for one page or listing; empty fields keep the page's own title/description/image. */
export const seoEntryInputSchema = z.object({
  path: seoPathSchema,
  title: z.string().trim().max(70, "Keep it under 70 characters"),
  description: z.string().trim().max(300),
  ogImage: imageUrlSchema.or(z.literal("")),
  noindex: z.boolean(),
});
export type SeoEntryInput = z.input<typeof seoEntryInputSchema>;

/** What generateMetadata merges over a page's own metadata. */
export interface SeoOverride {
  title?: string;
  description?: string;
  ogImage?: string;
  noindex?: boolean;
}
