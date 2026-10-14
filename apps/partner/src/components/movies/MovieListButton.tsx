"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { ConfirmDialog } from "@showbuzz/console-ui/ConfirmDialog";
import { Button } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { addMovieAction, removeMovieAction } from "@/app/_actions/movies";

/** Puts a catalogue film on the vendor's "My movies" list, or takes it off (asks first). */
export function MovieListButton({ movieId, title, added }: { movieId: string; title: string; added: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run(action: "add" | "remove") {
    startTransition(async () => {
      const result = action === "add" ? await addMovieAction(movieId) : await removeMovieAction(movieId);
      setConfirming(false);
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      toast.success(action === "add" ? `${title} added to your movies.` : `${title} removed from your movies.`);
      router.refresh();
    });
  }

  if (!added) {
    return (
      <Button type="button" disabled={pending} onClick={() => run("add")}>
        <Plus className="h-4 w-4" aria-hidden /> Add to my movies
      </Button>
    );
  }
  return (
    <>
      <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirming(true)}>
        <Minus className="h-4 w-4" aria-hidden /> Remove from my movies
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`Remove ${title} from your movies?`}
        description="The film stays on ShowBuzz; you just won't be able to schedule it until you add it again. Films with upcoming shows can't be removed."
        confirmLabel="Remove"
        pending={pending}
        onConfirm={() => run("remove")}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
