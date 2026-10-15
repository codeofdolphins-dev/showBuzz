"use client";

import { type ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import { applyActionError } from "@showbuzz/console-ui/action-errors";
import { ImageUrlField, SelectField, TextAreaField, TextField } from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { Card } from "@showbuzz/console-ui/PageParts";
import { useToast } from "@showbuzz/console-ui/Toaster";
import {
  DEFAULT_PAGES,
  aboutContentSchema,
  faqContentSchema,
  legalContentSchema,
  pageStatusSchema,
  type AboutContent,
  type FaqContent,
  type LegalContent,
  type PageStatus,
  type SitePageSlug,
} from "@showbuzz/schemas/site-content";
import { saveSitePageAction } from "@/app/_actions/marketing";
import { StringListEditor } from "./StringListEditor";

/**
 * Structured editors for the website pages (no rich text): Privacy and Terms are sections of heading + paragraphs +
 * bullet list; FAQ is question / answer pairs; About is a hero plus value cards. "Restore built-in text" loads the
 * content the site shipped with (saved only when you click Save). Drafts keep the site on the built-in text.
 */

const STATUS_OPTIONS = [
  { value: "published", label: "Published (the site shows this text)" },
  { value: "draft", label: "Draft (the site keeps the built-in text)" },
];

const legalForm = z.object({ status: pageStatusSchema, content: legalContentSchema });
const faqForm = z.object({ status: pageStatusSchema, content: faqContentSchema });
const aboutForm = z.object({ status: pageStatusSchema, content: aboutContentSchema });

function useSave<T extends FieldValues>(slug: SitePageSlug, form: UseFormReturn<T>) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const onSubmit = form.handleSubmit(() =>
    startTransition(async () => {
      setMessage(null);
      const result = await saveSitePageAction(slug, form.getValues());
      if (!result.success) {
        setMessage(applyActionError(form, result.error) ?? "Check the highlighted fields.");
        return;
      }
      toast.success("Page saved. showbuzz.com updates in a moment.");
      router.refresh();
    }),
  );
  return { pending, message, onSubmit };
}

function Toolbar({
  pending,
  onRestore,
  statusField,
}: {
  pending: boolean;
  onRestore: () => void;
  statusField: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-admin-border pt-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="w-full sm:max-w-sm">{statusField}</div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onRestore}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Restore built-in text
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save page"}
        </Button>
      </div>
    </div>
  );
}

function RowTools({
  index,
  count,
  onMove,
  onRemove,
  label,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  label: string;
}) {
  const icon = "rounded-md p-1.5 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo disabled:opacity-30";
  return (
    <span className="flex items-center gap-0.5">
      <button
        type="button"
        className={icon}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        aria-label={`Move ${label} up`}
      >
        <ArrowUp className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        className={icon}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
        aria-label={`Move ${label} down`}
      >
        <ArrowDown className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" className={icon} onClick={() => onRemove(index)} aria-label={`Remove ${label}`}>
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Privacy / Terms

export function LegalPageEditor({
  slug,
  status,
  content,
}: {
  slug: "privacy" | "terms";
  status: PageStatus;
  content: LegalContent;
}) {
  const form = useForm<z.input<typeof legalForm>, unknown, z.output<typeof legalForm>>({
    resolver: zodResolver(legalForm),
    defaultValues: { status, content },
  });
  const sections = useFieldArray({ control: form.control, name: "content.sections" });
  const { pending, message, onSubmit } = useSave(slug, form);
  const errors = form.formState.errors.content;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <Card className="p-5">
        <TextField label="Page title" required error={errors?.title?.message} {...form.register("content.title")} />
      </Card>
      {sections.fields.map((section, i) => (
        <Card key={section.id} className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <TextField
              label={`Section ${i + 1} heading`}
              required
              containerClassName="flex-1"
              error={errors?.sections?.[i]?.heading?.message}
              {...form.register(`content.sections.${i}.heading`)}
            />
            <RowTools
              index={i}
              count={sections.fields.length}
              onMove={sections.move}
              onRemove={sections.remove}
              label={`section ${i + 1}`}
            />
          </div>
          <Controller
            control={form.control}
            name={`content.sections.${i}.paragraphs`}
            render={({ field }) => (
              <StringListEditor
                label="Paragraphs"
                multiline
                value={field.value}
                onChange={field.onChange}
                addLabel="Add paragraph"
                max={10}
                errors={(errors?.sections?.[i]?.paragraphs as { message?: string }[] | undefined)?.map(
                  (e) => e?.message,
                )}
              />
            )}
          />
          <Controller
            control={form.control}
            name={`content.sections.${i}.bullets`}
            render={({ field }) => (
              <StringListEditor
                label="Bullet list"
                value={field.value}
                onChange={field.onChange}
                addLabel="Add list item"
                max={20}
                errors={(errors?.sections?.[i]?.bullets as { message?: string }[] | undefined)?.map((e) => e?.message)}
              />
            )}
          />
        </Card>
      ))}
      {errors?.sections?.message ? <FormMessage tone="error">{errors.sections.message}</FormMessage> : null}
      <Button
        type="button"
        variant="secondary"
        onClick={() => sections.append({ heading: "", paragraphs: [""], bullets: [] })}
      >
        <Plus className="h-4 w-4" aria-hidden /> Add section
      </Button>
      <Toolbar
        pending={pending}
        onRestore={() => form.reset({ status: form.getValues("status"), content: DEFAULT_PAGES[slug] })}
        statusField={<SelectField label="Status" options={STATUS_OPTIONS} {...form.register("status")} />}
      />
    </form>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// FAQ

export function FaqPageEditor({ status, content }: { status: PageStatus; content: FaqContent }) {
  const form = useForm<z.input<typeof faqForm>, unknown, z.output<typeof faqForm>>({
    resolver: zodResolver(faqForm),
    defaultValues: { status, content },
  });
  const items = useFieldArray({ control: form.control, name: "content.items" });
  const { pending, message, onSubmit } = useSave("faq", form);
  const errors = form.formState.errors.content;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <Card className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
        <TextField label="Eyebrow" error={errors?.eyebrow?.message} {...form.register("content.eyebrow")} />
        <TextField label="Page title" required error={errors?.title?.message} {...form.register("content.title")} />
        <TextField label="Intro" error={errors?.intro?.message} {...form.register("content.intro")} />
      </Card>
      {items.fields.map((item, i) => (
        <Card key={item.id} className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <TextField
              label={`Question ${i + 1}`}
              required
              containerClassName="flex-1"
              error={errors?.items?.[i]?.question?.message}
              {...form.register(`content.items.${i}.question`)}
            />
            <RowTools
              index={i}
              count={items.fields.length}
              onMove={items.move}
              onRemove={items.remove}
              label={`question ${i + 1}`}
            />
          </div>
          <TextAreaField
            label="Answer"
            required
            rows={3}
            error={errors?.items?.[i]?.answer?.message}
            {...form.register(`content.items.${i}.answer`)}
          />
        </Card>
      ))}
      {errors?.items?.message ? <FormMessage tone="error">{errors.items.message}</FormMessage> : null}
      <Button type="button" variant="secondary" onClick={() => items.append({ question: "", answer: "" })}>
        <Plus className="h-4 w-4" aria-hidden /> Add question
      </Button>
      <Toolbar
        pending={pending}
        onRestore={() => form.reset({ status: form.getValues("status"), content: DEFAULT_PAGES.faq })}
        statusField={<SelectField label="Status" options={STATUS_OPTIONS} {...form.register("status")} />}
      />
    </form>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// About

export function AboutPageEditor({ status, content }: { status: PageStatus; content: AboutContent }) {
  const form = useForm<z.input<typeof aboutForm>, unknown, z.output<typeof aboutForm>>({
    resolver: zodResolver(aboutForm),
    defaultValues: { status, content },
  });
  const cards = useFieldArray({ control: form.control, name: "content.cards" });
  const { pending, message, onSubmit } = useSave("about", form);
  const errors = form.formState.errors.content;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-bold text-admin-dark">Hero</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField label="Eyebrow" error={errors?.eyebrow?.message} {...form.register("content.eyebrow")} />
          <TextField label="Headline" required error={errors?.title?.message} {...form.register("content.title")} />
        </div>
        <TextAreaField label="Intro" rows={3} error={errors?.intro?.message} {...form.register("content.intro")} />
        <Controller
          control={form.control}
          name="content.imageUrl"
          render={({ field }) => (
            <ImageUrlField
              label="Wide image URL"
              required
              hint="An images.unsplash.com URL, or Copy URL in the Media Library."
              value={field.value}
              onChange={field.onChange}
              error={errors?.imageUrl?.message}
            />
          )}
        />
      </Card>
      {cards.fields.map((card, i) => (
        <Card key={card.id} className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <TextField
              label={`Value card ${i + 1} title`}
              required
              containerClassName="flex-1"
              error={errors?.cards?.[i]?.title?.message}
              {...form.register(`content.cards.${i}.title`)}
            />
            <RowTools
              index={i}
              count={cards.fields.length}
              onMove={cards.move}
              onRemove={cards.remove}
              label={`card ${i + 1}`}
            />
          </div>
          <TextAreaField
            label="Text"
            required
            rows={2}
            error={errors?.cards?.[i]?.text?.message}
            {...form.register(`content.cards.${i}.text`)}
          />
        </Card>
      ))}
      {errors?.cards?.message ? <FormMessage tone="error">{errors.cards.message}</FormMessage> : null}
      {cards.fields.length < 6 ? (
        <Button type="button" variant="secondary" onClick={() => cards.append({ title: "", text: "" })}>
          <Plus className="h-4 w-4" aria-hidden /> Add value card
        </Button>
      ) : null}
      <Toolbar
        pending={pending}
        onRestore={() => form.reset({ status: form.getValues("status"), content: DEFAULT_PAGES.about })}
        statusField={<SelectField label="Status" options={STATUS_OPTIONS} {...form.register("status")} />}
      />
    </form>
  );
}
