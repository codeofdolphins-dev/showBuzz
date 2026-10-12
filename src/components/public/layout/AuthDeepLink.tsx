"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { safeNextPath } from "@/lib/safe-next";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";

/**
 * Opens the sign-in modal for links like /?auth=signin&next=/account/bookings (where protected pages
 * send signed-out visitors), remembers `next` for after sign-in, and removes both params from the URL.
 * Uses useSearchParams, so it renders inside <Suspense>.
 */
export function AuthDeepLink() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const openAuthModal = useUiStore((s) => s.openAuthModal);
  const wantsSignIn = params.get("auth") === "signin";

  useEffect(() => {
    // Wait for the session answer: a signed-in visitor goes straight to `next` instead.
    if (!wantsSignIn || status === "unknown") return;
    const next = params.has("next") ? safeNextPath(params.get("next")) : undefined;
    if (status === "authenticated") {
      router.replace(next ?? pathname);
      return;
    }
    openAuthModal(next);
    const rest = new URLSearchParams(params);
    rest.delete("auth");
    rest.delete("next");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [wantsSignIn, status, params, pathname, router, openAuthModal]);

  return null;
}
