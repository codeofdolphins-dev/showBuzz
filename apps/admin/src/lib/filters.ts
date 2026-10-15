import type { z } from "zod";
import { param, type SearchParamsRecord } from "@showbuzz/console-ui/search-params";
import { isDateKey } from "@showbuzz/utils/dates";

/** A list filter from the URL, kept only when it is one of the schema's values (anything else = no filter). */
export function enumParam<T extends z.ZodType>(sp: SearchParamsRecord, name: string, schema: T): z.infer<T> | undefined {
  const parsed = schema.safeParse(param(sp, name));
  return parsed.success ? parsed.data : undefined;
}

/** An IST date key ("2026-10-15") from the URL, or undefined. */
export function dateParam(sp: SearchParamsRecord, name: string): string | undefined {
  const value = param(sp, name);
  return value && isDateKey(value) ? value : undefined;
}

/** Drops undefined values so optional query fields stay absent (exactOptionalPropertyTypes). */
export function defined<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== "")) as {
    [K in keyof T]: Exclude<T[K], undefined>;
  };
}
