const MAX_LENGTH = 512;

/**
 * A post-sign-in redirect target that can only point inside this site: a relative path starting with
 * exactly one "/". Anything else ("//evil.com", "https://evil.com", "/\evil.com", control characters,
 * over-long values) falls back to "/". Used by the refresh redirect and the sign-in modal.
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_LENGTH) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // Browsers treat "\" like "/" in URLs, and strip tabs/newlines, so "/\evil.com" or "/\t/evil.com"
  // could become a scheme-relative URL.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
