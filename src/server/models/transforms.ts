import "server-only";

/**
 * toJSON/toObject transform shared by models: exposes `id` instead of `_id`/`__v` and strips
 * credentials (`sessions`, any `*Hash` field) so a document can never leak them when serialised.
 * Code that needs those fields reads them from the document, not from a serialised copy.
 */
export function hidePrivateFields(_doc: unknown, ret: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(ret)) {
    if (key === "_id") out.id = String(value);
    else if (key === "__v" || key === "sessions" || key.endsWith("Hash")) continue;
    else out[key] = value;
  }
  return out;
}

export const serialisationOptions = { virtuals: false, versionKey: false, transform: hidePrivateFields } as const;
