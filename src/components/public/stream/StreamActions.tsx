"use client";

import { toast } from "@/stores/ui";

/** Streaming checkout is not built yet; the buttons explain that instead of faking a purchase. */
export function StreamActionButton({ label, className, children }: { label: string; className: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => toast(`${label} is coming soon. We'll notify you when streaming checkout opens.`, "info")}
      className={className}
    >
      {children}
    </button>
  );
}
