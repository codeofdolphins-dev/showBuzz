"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { MultiSelect } from "../fields";
import { Button, Input } from "../form";

interface OptionChipsProps {
  label: string;
  hint?: string;
  required?: boolean;
  suggestions: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string | undefined;
  /** Placeholder of the "add your own" box; omit to allow only the listed values (master data). */
  customPlaceholder?: string;
}

/**
 * Chips from a list (languages, genres, formats). Values already selected stay listed even when they are no longer in
 * `suggestions`. With `customPlaceholder`, a box adds values that aren't on the list.
 */
export function OptionChips({
  label,
  hint,
  required,
  suggestions,
  value,
  onChange,
  error,
  customPlaceholder,
}: OptionChipsProps) {
  const [custom, setCustom] = useState("");
  const options = [...new Set([...suggestions, ...value])].map((v) => ({ value: v, label: v }));

  function add() {
    const next = custom.trim().slice(0, 40);
    if (!next) return;
    if (!value.includes(next)) onChange([...value, next]);
    setCustom("");
  }

  return (
    <div className="space-y-2">
      <MultiSelect
        label={label}
        hint={hint}
        required={required}
        options={options}
        value={value}
        onChange={onChange}
        error={error}
      />
      {customPlaceholder ? (
      <div className="flex max-w-sm gap-2">
        <Input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={customPlaceholder}
          aria-label={customPlaceholder}
          maxLength={40}
        />
        <Button type="button" variant="secondary" onClick={add}>
          <Plus className="h-4 w-4" aria-hidden /> Add
        </Button>
      </div>
      ) : null}
    </div>
  );
}
