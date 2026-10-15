"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2, Upload } from "lucide-react";
import { ConfirmDialog } from "@showbuzz/console-ui/ConfirmDialog";
import { Button, FormMessage, Input, Label } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { deleteMediaAction, uploadMediaAction } from "@/app/_actions/catalog-tools";

const MAX_BYTES = 4 * 1024 * 1024;

/** Upload one image (JPEG/PNG/WebP, ≤ 4 MB) with an optional description. */
export function MediaUploader() {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return setError("Choose an image to upload.");
    if (file.size > MAX_BYTES) return setError("Images can be at most 4 MB.");
    startTransition(async () => {
      const result = await uploadMediaAction(formData);
      if (!result.success) {
        setError(result.error.fieldErrors?.file?.[0] ?? result.error.message);
        return;
      }
      await navigator.clipboard?.writeText(result.data.url).catch(() => undefined);
      toast.success(`Uploaded. Path ${result.data.url} copied.`);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <form
      action={submit}
      className="grid grid-cols-1 gap-3 rounded-xl border border-admin-border bg-white p-4 shadow-card md:grid-cols-[1fr_1fr_auto] md:items-end"
    >
      <div>
        <Label htmlFor="media-file" required>
          Image
        </Label>
        <Input
          ref={fileRef}
          id="media-file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </div>
      <div>
        <Label htmlFor="media-alt">Description</Label>
        <Input id="media-alt" name="alt" maxLength={200} placeholder="e.g. Chrono Nexus poster" />
      </div>
      <Button type="submit" disabled={pending}>
        <Upload className="h-4 w-4" aria-hidden /> {pending ? "Uploading…" : "Upload"}
      </Button>
      {error ? (
        <div className="md:col-span-3">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      ) : null}
      <p className="text-[11px] text-admin-subtle md:col-span-3">
        JPEG, PNG or WebP up to 4 MB. Paste the copied path (/media/…) into any image field: movies, events, banners,
        stream titles, food and pages.
      </p>
    </form>
  );
}

export function MediaItemActions({ id, url, filename }: { id: string; url: string; filename: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`Copied ${url}`);
    } catch {
      toast.info(url);
    }
  }

  function remove() {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteMediaAction(id);
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      setOpen(false);
      toast.success("Image deleted.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-admin-indigo hover:bg-admin-active"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden /> Copy URL
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md p-1 text-admin-muted hover:bg-red-50 hover:text-admin-danger"
        aria-label={`Delete ${filename}`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
      <ConfirmDialog
        open={open}
        title={`Delete ${filename}?`}
        description="Images still used by a movie, listing, banner, stream, food item or page can't be deleted."
        confirmLabel="Delete"
        tone="danger"
        pending={pending}
        onConfirm={remove}
        onCancel={() => setOpen(false)}
      >
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      </ConfirmDialog>
    </div>
  );
}
