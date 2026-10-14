/** Escapes user input for use inside a RegExp (case-insensitive search filters). */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** URL name from a title: "PVR INOX: Quest Mall" → "pvr-inox-quest-mall" (lowercase letters, digits, single dashes). */
export function slugify(text: string, max = 80): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max)
    .replace(/-$/, "");
}
