"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoaderCircle, Star } from "lucide-react";
import { submitReviewAction } from "@/app/(public)/_actions/engagement";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/auth";
import { toast } from "@/stores/ui";

interface ReviewDialogProps {
  movieId: string;
  label: string;
  className?: string;
  disabled?: boolean;
}

/** "Rate Now" / "Write Review" trigger plus the star-rating sheet. */
export function ReviewDialog({ movieId, label, className, disabled }: ReviewDialogProps) {
  const router = useRouter();
  const userName = useAuthStore((s) => s.user?.name);
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const result = await submitReviewAction({ movieId, rating: stars, text: text || undefined }, userName);
      if (!result.success) {
        toast(result.error.message, "error");
        return;
      }
      toast("Your review has been submitted!", "success");
      setOpen(false);
      setText("");
      setStars(5);
      router.refresh();
    });

  return (
    <>
      <button
        type="button"
        onClick={() => (disabled ? toast("Reviews open once the movie releases.", "info") : setOpen(true))}
        className={className}
      >
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} className="max-w-sm text-center">
        <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
          <Star className="h-5 w-5 fill-current" />
        </span>
        <h3 className="text-base font-extrabold text-slate-900 sm:text-lg">Rate this Movie</h3>
        <p className="mt-0.5 text-xs text-slate-500">Tap a star to rate from 1 to 5</p>
        <div className="my-4 flex justify-center gap-2.5" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setStars(n)}
              className="tap-active"
            >
              <Star className={cn("h-7 w-7", n <= stars ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Write a short review (optional)..."
          className="mb-3 h-20 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-800 focus:border-rose-500 focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="tap-active flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="gradient-btn tap-active flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-60"
          >
            {isPending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />} Submit Rating
          </button>
        </div>
      </Modal>
    </>
  );
}
