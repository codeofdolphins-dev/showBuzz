/**
 * Console menu types and helpers. Menus are plain data (icons are names, mapped to lucide components in the
 * client shell) so the server can filter them and pass them to client components. Each app defines its own menu.
 */

export type NavIcon =
  | "layout-dashboard"
  | "film"
  | "calendar-days"
  | "theater"
  | "trophy"
  | "compass"
  | "tv"
  | "grid"
  | "video"
  | "monitor"
  | "map-pin"
  | "armchair"
  | "clock"
  | "ticket"
  | "qr-code"
  | "plus-circle"
  | "credit-card"
  | "rotate-ccw"
  | "wallet"
  | "users"
  | "briefcase"
  | "send"
  | "tag"
  | "image"
  | "percent"
  | "gift"
  | "star"
  | "bar-chart"
  | "trending-up"
  | "settings"
  | "globe"
  | "languages"
  | "layers"
  | "folder"
  | "file-text"
  | "search"
  | "user-check"
  | "shield-check"
  | "scroll-text"
  | "database"
  | "utensils"
  | "building";

export interface NavItem {
  id: string;
  label: string;
  icon: NavIcon;
  href: string;
  permission?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: NavIcon;
  /** A single link (Dashboard, Show Scheduling) instead of a dropdown. */
  href?: string;
  permission?: string;
  children?: NavItem[];
}

/** The menu with every item `canSee` rejects removed (and groups left empty dropped). */
export function filterNav(nav: NavGroup[], canSee: (permission?: string) => boolean): NavGroup[] {
  return nav.flatMap((group) => {
    if (!group.children) return canSee(group.permission) ? [group] : [];
    const children = group.children.filter((item) => canSee(item.permission));
    return children.length ? [{ ...group, children }] : [];
  });
}

/** Flat list of pages (command palette, coming-soon routing). */
export function flattenNav(groups: NavGroup[]): NavItem[] {
  return groups.flatMap(
    (group) =>
      group.children ??
      (group.href
        ? [
            {
              id: group.id,
              label: group.label,
              icon: group.icon,
              href: group.href,
              ...(group.permission ? { permission: group.permission } : {}),
            },
          ]
        : []),
  );
}

/** The menu item for a path such as "/movies" or "/bookings/new", if any. */
export function findNavItemIn(nav: NavGroup[], pathname: string): NavItem | undefined {
  return flattenNav(nav).find((item) => item.href === pathname);
}
