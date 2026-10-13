"use client";

import { useEffect, useState } from "react";

/**
 * Seconds left until `expiresAt` (ISO), ticking every second; null before the first tick (the server render
 * can't know the browser's clock) or when there is nothing to count down to.
 */
export function useCountdown(expiresAt: string | undefined): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [expiresAt]);

  if (!expiresAt || now === null) return null;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
}

export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
