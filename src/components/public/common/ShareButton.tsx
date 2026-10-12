"use client";

import { Share2 } from "lucide-react";
import { toast } from "@/stores/ui";

export function ShareButton({ title, className }: { title: string; className?: string }) {
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // The user closed the share sheet.
      }
      return;
    }
    await navigator.clipboard?.writeText(url);
    toast("Link copied to clipboard!", "success");
  };

  return (
    <button type="button" onClick={share} aria-label="Share" className={className}>
      <Share2 className="h-4 w-4" />
    </button>
  );
}
