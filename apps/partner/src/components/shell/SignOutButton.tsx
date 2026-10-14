"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@showbuzz/console-ui/form";

/** Sign-out outside the console shell (onboarding). Only the logout route can revoke the session. */
export function SignOutButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await fetch("/api/v1/partner/auth/logout", { method: "POST" }).catch(() => undefined);
        // Full navigation (not router.push) so no page rendered for the old session stays in the client cache.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/login");
      }}
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
