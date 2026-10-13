"use client";

import { Heart } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";
import { toast } from "@/stores/ui";
import { useWishlistStore } from "@/stores/wishlist";

interface WishlistButtonProps {
  id: string;
  className?: string;
  activeClassName?: string;
  iconClassName?: string;
}

export function WishlistButton({ id, className, activeClassName = "text-rose-600", iconClassName }: WishlistButtonProps) {
  const saved = useWishlistStore((s) => s.ids.includes(id));
  const toggle = useWishlistStore((s) => s.toggle);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const added = toggle(id);
        toast(added ? "Added to your wishlist!" : "Removed from your wishlist.", added ? "success" : "info");
      }}
      aria-pressed={saved}
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
      className={cn("flex items-center justify-center transition-all", className, saved && activeClassName)}
    >
      <Heart className={cn("h-3.5 w-3.5", iconClassName, saved && "fill-current")} />
    </button>
  );
}
