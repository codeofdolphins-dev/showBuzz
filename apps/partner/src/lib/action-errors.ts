import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

/** The failure half of a Server Action result (ActionResult from @showbuzz/core). */
export interface ActionFailure {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Puts a Server Action's field errors on the matching React Hook Form fields (Zod errors arrive in `fieldErrors`,
 * AppErrors in `details.fieldErrors`). Returns the message to show when no field matched.
 */
export function applyActionError<T extends FieldValues>(form: UseFormReturn<T>, error: ActionFailure): string | null {
  const fieldErrors = error.fieldErrors ?? (error.details?.fieldErrors as Record<string, string[]> | undefined) ?? {};
  const known = new Set(Object.keys(form.getValues()));
  let matched = false;
  for (const [name, messages] of Object.entries(fieldErrors)) {
    const top = name.split(".")[0] ?? name;
    if (!messages[0] || !known.has(top)) continue;
    form.setError(name as Path<T>, { message: messages[0] });
    matched = true;
  }
  return matched ? null : error.message;
}
