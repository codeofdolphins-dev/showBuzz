"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/ui";

/**
 * Signs out this device. Uses POST /api/v1/auth/logout rather than a Server Action because only that
 * path receives the refresh cookie, so the session is revoked even when the access token has expired.
 */
export function useSignOut() {
  const router = useRouter();
  const pathname = usePathname();
  const clearSession = useAuthStore((s) => s.clearSession);

  return useCallback(async () => {
    try {
      const response = await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error(`Logout failed with ${response.status}`);
    } catch {
      toast("Couldn't sign you out. Please check your connection and try again.", "error");
      return;
    }
    clearSession();
    toast("Signed out successfully.", "info");
    if (pathname === "/account" || pathname.startsWith("/account/")) router.replace("/");
    else router.refresh();
  }, [clearSession, pathname, router]);
}
