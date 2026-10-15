import { z } from "zod";

/**
 * Staff permissions are "resource:action" strings. Resources follow the admin console menu (prototype
 * admin/assets/js/app.js); every resource has `read` and `write`, plus a few extra actions. The dashboard and
 * the staff member's own profile need no permission. Roles are data (`roles` collection); SYSTEM_ROLES below
 * is only what the seed script writes.
 */

export const PERMISSION_RESOURCES = [
  // Catalogue
  "movies",
  "events",
  "plays",
  "sports",
  "activities",
  "streaming",
  // Venues & seating
  "cinemas",
  "screens",
  "venues",
  "seat-layout",
  "seat-management",
  "shows",
  // Box office & sales
  "bookings",
  "payments",
  "refunds",
  "settlements",
  "customers",
  // "organisers" is the Vendors screen (kept as the resource name so roles already stored stay valid).
  "organisers",
  "plans",
  "invoices",
  "list-your-show",
  // Marketing
  "banners",
  "offers",
  "coupons",
  "gift-cards",
  "reviews",
  // Reports & analytics
  "reports",
  "analytics",
  // Master data & system
  "cities",
  "languages",
  "genres",
  "media-library",
  "pages",
  "seo",
  "users",
  "roles",
  "activity-log",
  "settings",
  "backup",
] as const;

export type PermissionResource = (typeof PERMISSION_RESOURCES)[number];

/** Actions beyond read/write. */
const EXTRA_PERMISSIONS = [
  "refunds:approve",
  "refunds:request",
  "scan-qr:use",
  // Super Admin only: set a temporary password for another staff member (no email provider yet).
  "users:reset-password",
  // Set a temporary password for a vendor's partner login (same stand-in as for staff).
  "organisers:reset-password",
  // Issue a complimentary gift card (creates spendable value, so it is separate from gift-cards:write).
  "gift-cards:issue",
] as const;

/** Every permission that exists, in a stable order (the role editor and the seed script use it). */
export const PERMISSIONS: readonly string[] = [
  ...PERMISSION_RESOURCES.flatMap((resource) => [`${resource}:read`, `${resource}:write`]),
  ...EXTRA_PERMISSIONS,
];

const PERMISSION_SET = new Set(PERMISSIONS);

export const permissionSchema = z.string().refine((value) => PERMISSION_SET.has(value), "Unknown permission");

export type Permission = string;

/** True when `granted` contains `required`. Write never implies anything else; roles list what they need. */
export function hasPermission(granted: readonly string[], required: string): boolean {
  return granted.includes(required);
}

/**
 * Resources vendors run themselves in the partner portal (venues, screens, seat layouts, shows, gate scanning).
 * The platform team has no screens for them, so the admin menu and the role editor leave them out; the permission
 * strings stay valid so roles stored before prompt 7 still parse.
 */
export const VENDOR_RUN_RESOURCES: readonly PermissionResource[] = [
  "cinemas",
  "screens",
  "venues",
  "seat-layout",
  "seat-management",
  "shows",
];

/** The role editor's matrix: platform resources, grouped like the admin menu. */
export const PERMISSION_GROUPS: readonly {
  label: string;
  resources: readonly { id: PermissionResource; label: string }[];
}[] = [
  {
    label: "Catalogue",
    resources: [
      { id: "movies", label: "Movies" },
      { id: "events", label: "Events & concerts" },
      { id: "plays", label: "Plays" },
      { id: "sports", label: "Sports" },
      { id: "activities", label: "Activities" },
      { id: "streaming", label: "Online streams" },
    ],
  },
  {
    label: "Box office & sales",
    resources: [
      { id: "bookings", label: "Bookings" },
      { id: "payments", label: "Payments" },
      { id: "refunds", label: "Refunds" },
      { id: "customers", label: "Customers" },
    ],
  },
  {
    label: "Vendors & billing",
    resources: [
      { id: "organisers", label: "Vendors" },
      { id: "settlements", label: "Vendor payouts" },
      { id: "invoices", label: "Subscription invoices" },
      { id: "plans", label: "Subscription plans" },
      { id: "list-your-show", label: "List-your-show requests" },
    ],
  },
  {
    label: "Marketing",
    resources: [
      { id: "banners", label: "Home banners" },
      { id: "offers", label: "Offers" },
      { id: "coupons", label: "Coupons" },
      { id: "gift-cards", label: "Gift cards" },
      { id: "reviews", label: "Reviews" },
    ],
  },
  {
    label: "Reports",
    resources: [
      { id: "reports", label: "Sales reports" },
      { id: "analytics", label: "Audience analytics" },
    ],
  },
  {
    label: "Master data & system",
    resources: [
      { id: "cities", label: "Cities" },
      { id: "languages", label: "Languages" },
      { id: "genres", label: "Genres" },
      { id: "media-library", label: "Media library" },
      { id: "pages", label: "Website pages" },
      { id: "seo", label: "SEO" },
      { id: "users", label: "Staff" },
      { id: "roles", label: "Roles" },
      { id: "activity-log", label: "Activity log" },
      { id: "settings", label: "Platform settings" },
      { id: "backup", label: "Backup" },
    ],
  },
];

/** Extra actions listed under the matrix. */
export const EXTRA_PERMISSION_LABELS: readonly { id: string; label: string }[] = [
  { id: "refunds:approve", label: "Approve refunds" },
  { id: "refunds:request", label: "Request refunds" },
  { id: "users:reset-password", label: "Reset staff passwords" },
  { id: "organisers:reset-password", label: "Reset vendor passwords" },
  { id: "gift-cards:issue", label: "Issue complimentary gift cards" },
];

const read = (...resources: PermissionResource[]) => resources.map((r) => `${r}:read`);
const write = (...resources: PermissionResource[]) => resources.flatMap((r) => [`${r}:read`, `${r}:write`]);

const LISTINGS: PermissionResource[] = ["movies", "events", "plays", "sports", "activities", "streaming"];

export interface SystemRoleDefinition {
  name: string;
  description: string;
  permissions: string[];
}

/**
 * The platform team's roles (prompt 7, 2026-10-15). The prototype's Cinema Manager and Event Manager ran cinemas and
 * events, which vendors now do themselves in the partner portal, so Operations and Marketing replace them.
 * `pnpm db:seed-roles` turns stored legacy roles into custom roles (or deletes them when no one uses them) and
 * re-syncs every system role that hasn't been edited in the console.
 */
export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    name: "Super Admin",
    description: "Full access to every module, staff accounts, roles and platform settings.",
    permissions: [...PERMISSIONS],
  },
  {
    name: "Operations",
    description: "Runs the marketplace: vendors, list-your-show requests, the movie catalogue, bookings and master data.",
    permissions: [
      ...write("organisers", "list-your-show", "movies", "bookings", "customers", "cities", "languages", "genres"),
      ...read("events", "plays", "sports", "activities", "streaming"),
      ...read("payments", "refunds", "settlements", "plans", "reviews", "reports", "activity-log"),
    ],
  },
  {
    name: "Finance",
    description: "Payments, refunds, vendor payouts, plans and subscription invoices; read access for reconciliation.",
    permissions: [
      ...write("payments", "refunds", "settlements", "invoices", "plans"),
      ...read("bookings", "customers", "organisers", "coupons", "gift-cards", "reports", "analytics", "activity-log"),
      "refunds:approve",
    ],
  },
  {
    name: "Support",
    description: "Customer support: customers (block / unblock), bookings and cancellations, reviews, refund requests.",
    permissions: [
      ...write("customers", "bookings", "reviews"),
      ...read(...LISTINGS, "refunds", "payments", "gift-cards", "organisers", "list-your-show"),
      "refunds:request",
    ],
  },
  {
    name: "Marketing",
    description: "Home banners, coupons and offers, gift cards, website pages and SEO.",
    permissions: [
      ...write("banners", "offers", "coupons", "gift-cards", "pages", "seo"),
      ...read(...LISTINGS, "reviews", "reports", "analytics"),
      "gift-cards:issue",
    ],
  },
];

/** System roles from before prompt 7 (vendor-style): kept only as custom roles while staff still use them. */
export const LEGACY_SYSTEM_ROLES: readonly string[] = ["Cinema Manager", "Event Manager"];

export const SUPER_ADMIN_ROLE = "Super Admin";
