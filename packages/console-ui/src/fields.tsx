"use client";

import { useId, useState, type ChangeEvent, type ComponentProps, type ReactNode } from "react";
import { Check, FileText, ImageOff, Upload } from "lucide-react";
import { cn } from "@showbuzz/utils/cn";
import { FieldError, Input, Label, Select, Textarea } from "./form";

/**
 * Labelled form fields for console forms. Text, number, select and textarea fields spread their props onto the
 * native control, so React Hook Form's `register("name")` works directly (it includes the ref). Toggle, multi-select,
 * date/time, money and image fields are controlled (`value` + `onChange`): use them through RHF's <Controller>.
 */

type ErrorProp = string | string[] | undefined;

const messages = (error: ErrorProp) => (error === undefined ? undefined : Array.isArray(error) ? error : [error]);

interface FieldShellProps {
  id: string;
  label: ReactNode;
  required?: boolean | undefined;
  hint?: ReactNode;
  error?: ErrorProp;
  className?: string | undefined;
  children: ReactNode;
}

/** Label + control + hint + error; wire your own control to `id` and `${id}-error` / `${id}-hint`. */
export function FieldShell({ id, label, required, hint, error, className, children }: FieldShellProps) {
  return (
    <div className={className}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {hint && !messages(error)?.length ? (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-admin-subtle">
          {hint}
        </p>
      ) : null}
      <FieldError id={`${id}-error`} messages={messages(error)} />
    </div>
  );
}

function describedBy(id: string, error: ErrorProp, hint: ReactNode) {
  if (messages(error)?.length) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

interface CommonProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ErrorProp;
  containerClassName?: string;
}

export function TextField({
  label,
  hint,
  error,
  containerClassName,
  id,
  required,
  ...props
}: CommonProps & ComponentProps<"input">) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  return (
    <FieldShell id={fieldId} label={label} required={required} hint={hint} error={error} className={containerClassName}>
      <Input
        id={fieldId}
        required={required}
        aria-invalid={messages(error)?.length ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...props}
      />
    </FieldShell>
  );
}

/** Numeric input; with RHF use `register("x", { valueAsNumber: true })`. */
export function NumberField(props: CommonProps & Omit<ComponentProps<"input">, "type">) {
  return <TextField type="number" inputMode="decimal" {...props} />;
}

export function TextAreaField({
  label,
  hint,
  error,
  containerClassName,
  id,
  required,
  ...props
}: CommonProps & ComponentProps<"textarea">) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  return (
    <FieldShell id={fieldId} label={label} required={required} hint={hint} error={error} className={containerClassName}>
      <Textarea
        id={fieldId}
        required={required}
        aria-invalid={messages(error)?.length ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...props}
      />
    </FieldShell>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function SelectField({
  label,
  hint,
  error,
  containerClassName,
  id,
  required,
  options,
  placeholder,
  ...props
}: CommonProps & ComponentProps<"select"> & { options: readonly Option[]; placeholder?: string }) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  return (
    <FieldShell id={fieldId} label={label} required={required} hint={hint} error={error} className={containerClassName}>
      <Select
        id={fieldId}
        required={required}
        aria-invalid={messages(error)?.length ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </FieldShell>
  );
}

interface ControlledProps<T> extends CommonProps {
  value: T;
  onChange: (value: T) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
}

/** Checkbox chips; the value is the list of selected option values. */
export function MultiSelect({
  label,
  hint,
  error,
  containerClassName,
  options,
  value,
  onChange,
  required,
  disabled,
  id,
}: ControlledProps<string[]> & { options: readonly Option[] }) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  const toggle = (optionValue: string) =>
    onChange(value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue]);
  return (
    <fieldset className={containerClassName} aria-describedby={describedBy(fieldId, error, hint)}>
      <legend className="mb-1 block text-[13px] font-semibold text-admin-text">
        {label}
        {required ? <span className="ml-0.5 text-admin-danger">*</span> : null}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => toggle(option.value)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60",
                selected
                  ? "border-admin-indigo bg-admin-active text-admin-indigo"
                  : "border-admin-border bg-white text-admin-muted hover:border-slate-300",
              )}
            >
              {selected ? <Check className="h-3 w-3" aria-hidden /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
      {hint && !messages(error)?.length ? (
        <p id={`${fieldId}-hint`} className="mt-1 text-[11px] text-admin-subtle">
          {hint}
        </p>
      ) : null}
      <FieldError id={`${fieldId}-error`} messages={messages(error)} />
    </fieldset>
  );
}

/** On/off switch with a label and optional description. */
export function Toggle({
  label,
  hint,
  error,
  containerClassName,
  value,
  onChange,
  disabled,
  id,
}: ControlledProps<boolean>) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  return (
    <div className={cn("flex items-start justify-between gap-4", containerClassName)}>
      <div>
        <label htmlFor={fieldId} className="block text-[13px] font-semibold text-admin-text">
          {label}
        </label>
        {hint ? <p className="text-[11px] text-admin-subtle">{hint}</p> : null}
        <FieldError id={`${fieldId}-error`} messages={messages(error)} />
      </div>
      <button
        id={fieldId}
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
          value ? "bg-admin-indigo" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            value ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

const IST_OFFSET_MS = 330 * 60 * 1000;

/** UTC ISO string → "YYYY-MM-DDTHH:mm" in IST (what <input type="datetime-local"> shows). */
export function utcToIstInput(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? "" : new Date(time + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" typed in IST → UTC ISO string ("" when empty or invalid). IST has no daylight saving. */
export function istInputToUtc(local: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return "";
  const time = Date.parse(`${local}:00+05:30`);
  return Number.isNaN(time) ? "" : new Date(time).toISOString();
}

/**
 * Date and time entered and shown in IST whatever the browser's time zone. The value is a UTC ISO string
 * ("" when empty), which is what the server stores. With `dateOnly`, the value is an IST date key "YYYY-MM-DD".
 */
export function DateTimeField({
  label,
  hint,
  error,
  containerClassName,
  value,
  onChange,
  required,
  disabled,
  id,
  name,
  dateOnly = false,
  min,
  max,
}: ControlledProps<string> & { dateOnly?: boolean; min?: string; max?: string }) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  const shown = dateOnly ? value : utcToIstInput(value);
  return (
    <FieldShell
      id={fieldId}
      label={label}
      required={required}
      hint={hint ?? (dateOnly ? undefined : "Indian Standard Time (IST)")}
      error={error}
      className={containerClassName}
    >
      <Input
        id={fieldId}
        name={name}
        type={dateOnly ? "date" : "datetime-local"}
        value={shown}
        min={min && !dateOnly ? utcToIstInput(min) : min}
        max={max && !dateOnly ? utcToIstInput(max) : max}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(dateOnly ? event.target.value : istInputToUtc(event.target.value))}
        aria-invalid={messages(error)?.length ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint ?? (dateOnly ? undefined : "ist"))}
      />
    </FieldShell>
  );
}

function paiseToText(paise: number | undefined): string {
  if (paise === undefined || !Number.isFinite(paise)) return "";
  return (paise / 100).toFixed(2).replace(/\.00$/, "");
}

function textToPaise(text: string): number | undefined {
  const clean = text.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return undefined;
  return Math.round(Number(clean) * 100);
}

/**
 * Amount typed in rupees (up to 2 decimals), value in integer paise (undefined while empty or invalid), the unit
 * every service and schema uses.
 */
export function MoneyInput({
  label,
  hint,
  error,
  containerClassName,
  value,
  onChange,
  required,
  disabled,
  id,
  name,
}: ControlledProps<number | undefined>) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  const [text, setText] = useState(() => paiseToText(value));
  const [lastValue, setLastValue] = useState(value);

  // The form reset or set the value from outside: show it (typing keeps its own partial text like "12.").
  if (value !== lastValue) {
    setLastValue(value);
    if (textToPaise(text) !== value) setText(paiseToText(value));
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setText(next);
    const paise = textToPaise(next);
    setLastValue(paise);
    onChange(paise);
  }

  return (
    <FieldShell id={fieldId} label={label} required={required} hint={hint} error={error} className={containerClassName}>
      <div className="relative">
        <span className="pointer-events-none absolute top-2 left-3 text-xs font-bold text-admin-muted">₹</span>
        <Input
          id={fieldId}
          name={name}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={onInput}
          required={required}
          disabled={disabled}
          className="pl-7"
          placeholder="0"
          aria-invalid={messages(error)?.length ? true : undefined}
          aria-describedby={describedBy(fieldId, error, hint)}
        />
      </div>
    </FieldShell>
  );
}

/**
 * Image URL with a live preview (posters, banners): an images.unsplash.com URL or a Media Library path
 * (`/media/<id>`, served by every app). Remote images can't go through next/image without config.
 */
export function ImageUrlField({
  label,
  hint,
  error,
  containerClassName,
  value,
  onChange,
  required,
  disabled,
  id,
  name,
  aspect = "aspect-video",
}: ControlledProps<string> & { aspect?: string }) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPreview = (/^https:\/\/\S+$/.test(value) || /^\/media\/[0-9a-f]{24}$/.test(value)) && failedUrl !== value;
  return (
    <FieldShell id={fieldId} label={label} required={required} hint={hint} error={error} className={containerClassName}>
      <div className="space-y-2">
        <Input
          id={fieldId}
          name={name}
          type="text"
          inputMode="url"
          value={value}
          onChange={(event) => onChange(event.target.value.trim())}
          required={required}
          disabled={disabled}
          placeholder="https://images.unsplash.com/… or /media/…"
          aria-invalid={messages(error)?.length ? true : undefined}
          aria-describedby={describedBy(fieldId, error, hint)}
        />
        <div
          className={cn(
            "flex w-40 items-center justify-center overflow-hidden rounded-lg border border-dashed border-admin-border bg-slate-50",
            aspect,
          )}
        >
          {showPreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote URLs; next/image needs remotePatterns
            <img src={value} alt="" className="h-full w-full object-cover" onError={() => setFailedUrl(value)} />
          ) : (
            <span className="flex flex-col items-center gap-1 text-[10px] text-admin-subtle">
              <ImageOff className="h-4 w-4" aria-hidden />
              {value ? "Preview unavailable" : "No image"}
            </span>
          )}
        </div>
      </div>
    </FieldShell>
  );
}

export interface CurrentFile {
  filename: string;
  /** Link to view the stored file (an authenticated route). */
  href?: string;
}

/**
 * File picker with a client-side size/type pre-check (the server checks again: first bytes and size). The chosen
 * file is passed to `onFileChange`; give the input a `name` to send it in a FormData.
 */
export function FileUpload({
  label,
  hint,
  error,
  containerClassName,
  id,
  name,
  required,
  disabled,
  accept = "application/pdf,image/jpeg,image/png",
  maxBytes = 4 * 1024 * 1024,
  current,
  onFileChange,
}: CommonProps & {
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  accept?: string;
  maxBytes?: number;
  current?: CurrentFile | undefined;
  onFileChange?: (file: File | null) => void;
}) {
  const fallbackId = useId();
  const fieldId = id ?? fallbackId;
  const [chosen, setChosen] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setLocalError(null);
    if (file && file.size > maxBytes) {
      setLocalError(`Files can be at most ${Math.round(maxBytes / 1024 / 1024)} MB.`);
      event.target.value = "";
      setChosen(null);
      onFileChange?.(null);
      return;
    }
    setChosen(file?.name ?? null);
    onFileChange?.(file);
  }

  const shownError = localError ?? error;
  return (
    <FieldShell
      id={fieldId}
      label={label}
      required={required}
      hint={hint ?? "PDF, JPEG or PNG, up to 4 MB."}
      error={shownError}
      className={containerClassName}
    >
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-admin-border bg-slate-50 p-3 sm:flex-row sm:items-center">
        <label
          htmlFor={fieldId}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-admin-border bg-white px-3 py-2 text-xs font-bold text-admin-text hover:border-admin-indigo hover:text-admin-indigo",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {current || chosen ? "Replace file" : "Choose file"}
        </label>
        <input
          id={fieldId}
          name={name}
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={onChange}
          className="sr-only"
          aria-invalid={messages(shownError ?? undefined)?.length ? true : undefined}
          aria-describedby={describedBy(fieldId, shownError ?? undefined, hint ?? "files")}
        />
        <div className="min-w-0 flex-1 text-[11px]">
          {chosen ? (
            <span className="font-semibold text-admin-dark">Selected: {chosen}</span>
          ) : current ? (
            <span className="flex items-center gap-1 text-admin-muted">
              <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {current.href ? (
                <a
                  href={current.href}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-semibold text-admin-indigo hover:underline"
                >
                  {current.filename}
                </a>
              ) : (
                <span className="truncate">{current.filename}</span>
              )}
            </span>
          ) : (
            <span className="text-admin-subtle">No file chosen</span>
          )}
        </div>
      </div>
    </FieldShell>
  );
}
