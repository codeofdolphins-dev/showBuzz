"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, FieldError, Input, Textarea } from "@showbuzz/console-ui/form";

interface StringListEditorProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  /** Paragraphs use a textarea per item; list items a single line. */
  multiline?: boolean;
  addLabel: string;
  max: number;
  /** Error message per item index. */
  errors?: (string | undefined)[];
}

/** A list of texts edited as separate fields (paragraphs or bullet items), with add / remove / move. */
export function StringListEditor({
  label,
  value,
  onChange,
  multiline = false,
  addLabel,
  max,
  errors = [],
}: StringListEditorProps) {
  const update = (index: number, text: string) => onChange(value.map((v, i) => (i === index ? text : v)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...value];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };
  const icon = "rounded-md p-1 text-admin-muted hover:bg-slate-100 hover:text-admin-indigo disabled:opacity-30";

  return (
    <fieldset className="space-y-2">
      <legend className="text-[12px] font-semibold text-admin-text">{label}</legend>
      {value.map((text, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex-1">
            {multiline ? (
              <Textarea
                value={text}
                rows={3}
                aria-label={`${label} ${index + 1}`}
                aria-invalid={errors[index] ? true : undefined}
                onChange={(event) => update(index, event.target.value)}
              />
            ) : (
              <Input
                value={text}
                aria-label={`${label} ${index + 1}`}
                aria-invalid={errors[index] ? true : undefined}
                onChange={(event) => update(index, event.target.value)}
              />
            )}
            <FieldError id={`${label}-${index}-error`} messages={errors[index] ? [errors[index]] : undefined} />
          </div>
          <div className="flex shrink-0 flex-col">
            <button type="button" className={icon} disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up">
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className={icon}
              disabled={index === value.length - 1}
              onClick={() => move(index, 1)}
              aria-label="Move down"
            >
              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className={icon}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      ))}
      {value.length < max ? (
        <Button type="button" variant="ghost" onClick={() => onChange([...value, ""])}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> {addLabel}
        </Button>
      ) : null}
    </fieldset>
  );
}
