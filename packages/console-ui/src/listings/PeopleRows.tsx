"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, FieldError, Input } from "../form";

export interface PersonRow {
  name: string;
  role: string;
  image?: string;
}

interface PeopleRowsProps {
  title: string;
  rows: PersonRow[];
  /** Show the photo URL column (cast, artists). */
  withImage: boolean;
  onChange: (rows: PersonRow[]) => void;
  /** Field errors by row index ("0.name" → message). */
  errors?: Record<string, string | undefined>;
  addLabel: string;
  max: number;
}

/** Editable name / role (/ photo) rows: cast, crew and performing artists (prototype movie-form section 3). */
export function PeopleRows({ title, rows, withImage, onChange, errors = {}, addLabel, max }: PeopleRowsProps) {
  const update = (index: number, patch: Partial<PersonRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-[13px] font-semibold text-admin-text">{title}</legend>
      {rows.length === 0 ? <p className="text-[11px] text-admin-subtle">None added yet.</p> : null}
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-2 rounded-lg border border-admin-border bg-slate-50/60 p-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]"
        >
          <div>
            <Input
              value={row.name}
              onChange={(event) => update(index, { name: event.target.value })}
              placeholder="Name"
              aria-label={`${title} ${index + 1} name`}
              maxLength={80}
            />
            <FieldError
              id={`${title}-${index}-name`}
              messages={errors[`${index}.name`] ? [errors[`${index}.name`] ?? ""] : undefined}
            />
          </div>
          <div>
            <Input
              value={row.role}
              onChange={(event) => update(index, { role: event.target.value })}
              placeholder="Character / role (e.g. Lead, Director)"
              aria-label={`${title} ${index + 1} role`}
              maxLength={80}
            />
            <FieldError
              id={`${title}-${index}-role`}
              messages={errors[`${index}.role`] ? [errors[`${index}.role`] ?? ""] : undefined}
            />
          </div>
          {withImage ? (
            <div>
              <Input
                type="url"
                value={row.image ?? ""}
                onChange={(event) => update(index, { image: event.target.value.trim() })}
                placeholder="Photo URL (https://)"
                aria-label={`${title} ${index + 1} photo URL`}
              />
              <FieldError
                id={`${title}-${index}-image`}
                messages={errors[`${index}.image`] ? [errors[`${index}.image`] ?? ""] : undefined}
              />
            </div>
          ) : (
            <span className="hidden sm:block" />
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            aria-label={`Remove ${title} ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ))}
      {rows.length < max ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChange([...rows, withImage ? { name: "", role: "", image: "" } : { name: "", role: "" }])}
        >
          <Plus className="h-4 w-4" aria-hidden /> {addLabel}
        </Button>
      ) : null}
    </fieldset>
  );
}

/** Flattens RHF errors of an array field ({ 0: { name: { message } } }) into "0.name" → message. */
export function rowErrors(errors: unknown): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  if (!errors || typeof errors !== "object") return out;
  for (const [index, row] of Object.entries(errors as Record<string, unknown>)) {
    if (!row || typeof row !== "object") continue;
    for (const [field, value] of Object.entries(row as Record<string, unknown>)) {
      const message = (value as { message?: unknown } | undefined)?.message;
      if (typeof message === "string") out[`${index}.${field}`] = message;
    }
  }
  return out;
}
