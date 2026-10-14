import { z } from "zod";
import { idSchema, objectIdSchema, paiseSchema } from "./common";
import {
  type SeatAccent,
  type VenueKind,
  screenLayoutTypeSchema,
  seatAccentSchema,
  seatRowSchema,
  venueKindSchema,
  venueStatusSchema,
} from "./venue";

/**
 * Partner portal: a vendor's venues, screens, seat layouts and per-show seat blocks. The same schemas validate the
 * forms (React Hook Form) and the Server Actions; the vendor always comes from the session, never from these inputs.
 */

export const VENUE_KIND_LABELS: Record<VenueKind, string> = {
  cinema: "Cinema / Multiplex",
  stadium: "Stadium / Arena",
  venue: "Event venue",
};

/** Suggestions for the amenities field (from the seeded cinemas and the prototype venue table); free text allowed. */
export const VENUE_AMENITY_OPTIONS = [
  "Dolby Atmos",
  "IMAX",
  "4DX",
  "Recliner Seats",
  "Wheelchair Accessible",
  "Parking",
  "Valet Parking",
  "Food Court",
  "M-Ticket",
  "VIP Lounge",
] as const;

export const SCREEN_FORMAT_OPTIONS = [
  "2D",
  "3D",
  "IMAX 2D",
  "IMAX 3D",
  "4DX",
  "ScreenX",
  "Dolby Cinema",
  "Laser",
  "Live Event",
] as const;

/** The prototype designer's categories and colours; vendors may also name their own. */
export const SEAT_CATEGORY_PRESETS: { name: string; accent: SeatAccent; recliner: boolean; pricePaise: number }[] = [
  { name: "Recliner", accent: "amber", recliner: true, pricePaise: 65_000 },
  { name: "Executive", accent: "teal", recliner: false, pricePaise: 45_000 },
  { name: "Premium", accent: "blue", recliner: false, pricePaise: 35_000 },
  { name: "Regular", accent: "indigo", recliner: false, pricePaise: 25_000 },
  { name: "VIP", accent: "purple", recliner: false, pricePaise: 80_000 },
  { name: "Wheelchair", accent: "green", recliner: false, pricePaise: 25_000 },
];

export const venueInputSchema = z.object({
  kind: venueKindSchema,
  name: z.string().trim().min(2, "Enter the venue name").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Enter a URL name")
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes"),
  cityId: idSchema.or(z.literal("")).refine((v) => v !== "", "Choose a city"),
  address: z.string().trim().min(5, "Enter the full address").max(300),
  phone: z
    .string()
    .trim()
    .max(24)
    .regex(/^[0-9+\-() ]*$/, "Use digits, spaces, + and - only"),
  amenities: z.array(z.string().trim().min(1).max(40)).max(20, "Up to 20 amenities"),
  cancellationAllowed: z.boolean(),
  status: venueStatusSchema,
});

export const screenInputSchema = z.object({
  name: z.string().trim().min(1, "Enter the screen name").max(60),
  layoutType: screenLayoutTypeSchema,
  formats: z.array(z.string().trim().min(1).max(30)).max(12),
  soundSystem: z.string().trim().max(60),
});

export const seatLayoutZoneInputSchema = z.object({
  /** An existing category keeps its id (shows price by it); new categories get one on the server. */
  id: idSchema.optional(),
  name: z.string().trim().min(1, "Name the category").max(40),
  description: z.string().trim().max(80),
  accent: seatAccentSchema,
  recliner: z.boolean(),
  defaultPricePaise: paiseSchema.max(10_000_00, "At most ₹10,000"),
  rows: z.array(seatRowSchema).min(1, "Give every category at least one row"),
});

const MAX_CATEGORIES = 12;

export const seatLayoutInputSchema = z
  .object({
    /** The layout version the designer started from, so two tabs can't overwrite each other's changes. */
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    zones: z.array(seatLayoutZoneInputSchema).min(1, "Add at least one category").max(MAX_CATEGORIES),
  })
  .superRefine((layout, ctx) => {
    const letters = new Set<string>();
    const names = new Set<string>();
    let sellable = 0;
    layout.zones.forEach((zone, z) => {
      const name = zone.name.toLowerCase();
      if (names.has(name)) ctx.addIssue({ code: "custom", path: ["zones", z, "name"], message: "Names must differ" });
      names.add(name);
      zone.rows.forEach((row, r) => {
        const path = ["zones", z, "rows", r];
        if (letters.has(row.row)) ctx.addIssue({ code: "custom", path, message: `Row ${row.row} appears twice` });
        letters.add(row.row);
        const outside = [...row.aislesAfter, ...row.accessibleSeats, ...row.blockedSeats].some((n) => n > row.count);
        if (outside) ctx.addIssue({ code: "custom", path, message: `Row ${row.row} marks a seat it doesn't have` });
        sellable += row.count - new Set(row.blockedSeats).size;
      });
    });
    if (sellable === 0) ctx.addIssue({ code: "custom", path: ["zones"], message: "Leave at least one seat sellable" });
  });

export const seatIdSchema = z.string().regex(/^[A-Z]\d{1,2}$/, "Invalid seat");

/** Seats picked on one show's live map (block, unblock, release a hold). */
export const showSeatSelectionSchema = z.object({
  showId: objectIdSchema,
  seatIds: z.array(seatIdSchema).min(1, "Select at least one seat").max(1000),
});

export type VenueInput = z.infer<typeof venueInputSchema>;
export type ScreenInput = z.infer<typeof screenInputSchema>;
export type SeatLayoutInput = z.infer<typeof seatLayoutInputSchema>;
export type SeatLayoutZoneInput = z.infer<typeof seatLayoutZoneInputSchema>;
export type ShowSeatSelection = z.infer<typeof showSeatSelectionSchema>;
