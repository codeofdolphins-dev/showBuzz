import { z } from "zod";
import { hostedImageUrlSchema, slugSchema } from "./common";

/**
 * Admin catalogue oversight and tools (admin batch 9): taking vendor listings down, online stream titles, the Media
 * Library and audience analytics.
 */

/** Listing kinds and the admin route / permission resource of each. */
export const LISTING_SECTIONS = {
  event: { path: "/events", resource: "events", one: "Event", many: "Events & Concerts", publicPath: "/events" },
  play: { path: "/plays", resource: "plays", one: "Play", many: "Plays & Drama", publicPath: "/plays" },
  sport: { path: "/sports", resource: "sports", one: "Fixture", many: "Sports Ticketing", publicPath: "/sports" },
  activity: {
    path: "/activities",
    resource: "activities",
    one: "Activity",
    many: "Activities & Fun",
    publicPath: "/activities",
  },
} as const;
export type ListingKind = keyof typeof LISTING_SECTIONS;

export const listingAdminStatusSchema = z.enum(["active", "inactive", "taken_down"]);
export const listingWhenSchema = z.enum(["upcoming", "past"]);
export type ListingAdminStatus = z.infer<typeof listingAdminStatusSchema>;

export const takedownSchema = z.object({
  reason: z.string().trim().min(5, "Give a reason of at least 5 characters").max(300),
});

// Online streams ----------------------------------------------------------------------------------------------------

export const STREAM_CATEGORIES = ["Movie", "Documentary", "Concert", "Comedy Special", "Series", "Kids"] as const;

export const streamTitleInputSchema = z
  .object({
    title: z.string().trim().min(2, "Enter the title").max(120),
    slug: slugSchema,
    category: z.string().trim().min(2, "Choose a category").max(40),
    badge: z.string().trim().max(24),
    rentPricePaise: z.int().min(0).max(10_000_00),
    buyPricePaise: z.int().min(0).max(10_000_00),
    durationMinutes: z.int().min(1, "Enter the running time").max(1_000),
    rating: z.number().min(0).max(10),
    poster: hostedImageUrlSchema,
    description: z.string().trim().min(10, "Write at least a sentence").max(1_000),
    featured: z.boolean(),
    status: z.enum(["active", "inactive"]),
  })
  .refine((v) => v.buyPricePaise === 0 || v.buyPricePaise >= v.rentPricePaise, {
    path: ["buyPricePaise"],
    message: "Buying should cost at least as much as renting",
  });
export type StreamTitleInput = z.infer<typeof streamTitleInputSchema>;

// Media Library -----------------------------------------------------------------------------------------------------

export const mediaAltSchema = z.string().trim().max(200).default("");

// Audience analytics ------------------------------------------------------------------------------------------------

export const ANALYTICS_RANGES = ["7d", "30d", "90d"] as const;
export const analyticsRangeSchema = z.enum(ANALYTICS_RANGES);
export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;
export const ANALYTICS_RANGE_DAYS: Record<AnalyticsRange, number> = { "7d": 7, "30d": 30, "90d": 90 };

export const BOOKING_DEVICES = ["mobile", "tablet", "desktop"] as const;
export type BookingDevice = (typeof BOOKING_DEVICES)[number];
