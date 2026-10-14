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

const read = (...resources: PermissionResource[]) => resources.map((r) => `${r}:read`);
const write = (...resources: PermissionResource[]) => resources.flatMap((r) => [`${r}:read`, `${r}:write`]);

const LIVE_ENTERTAINMENT: PermissionResource[] = ["events", "plays", "sports", "activities", "streaming"];

export interface SystemRoleDefinition {
  name: string;
  description: string;
  permissions: string[];
}

/**
 * The five roles from the prototype matrix (admin/roles.html). The matrix only covers dashboard, movies, shows,
 * seat layouts and refunds; the other areas follow each role's job (agreed 2026-10-13). Data scoping ("cinema
 * only", "events only") is not enforced yet: it needs venue ownership on staff accounts.
 */
export const SYSTEM_ROLES: readonly SystemRoleDefinition[] = [
  {
    name: "Super Admin",
    description: "Full access to every module, staff accounts, roles and platform settings.",
    permissions: [...PERMISSIONS],
  },
  {
    name: "Cinema Manager",
    description: "Runs cinemas: screens, seat layouts, show scheduling and box-office check-in.",
    permissions: [
      ...read("reports", "analytics", "movies", "venues", "bookings"),
      ...write("cinemas", "screens", "seat-layout", "seat-management", "shows"),
      "scan-qr:use",
    ],
  },
  {
    name: "Event Manager",
    description: "Runs live events, plays, sports and activities, their venues and organisers.",
    permissions: [
      ...read("reports", "analytics", "seat-layout", "bookings"),
      ...write(...LIVE_ENTERTAINMENT, "venues", "organisers", "list-your-show"),
      "scan-qr:use",
    ],
  },
  {
    name: "Finance",
    description: "Payments, refunds approval and organiser settlements; read access for reconciliation.",
    permissions: [
      ...read(
        "reports",
        "analytics",
        "movies",
        ...LIVE_ENTERTAINMENT,
        "shows",
        "bookings",
        "customers",
        "organisers",
        "offers",
        "coupons",
        "gift-cards",
      ),
      ...read("plans"),
      ...write("payments", "refunds", "settlements", "invoices"),
      "refunds:approve",
    ],
  },
  {
    name: "Support",
    description: "Customer support: bookings, customers, reviews and refund requests.",
    permissions: [
      ...read("movies", ...LIVE_ENTERTAINMENT, "shows", "customers", "refunds", "list-your-show"),
      ...write("bookings", "reviews"),
      "refunds:request",
    ],
  },
];

export const SUPER_ADMIN_ROLE = "Super Admin";
