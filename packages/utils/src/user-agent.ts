/**
 * A short, human label for a browser user agent ("Chrome on Windows", "Safari on iPhone"), for the list of
 * signed-in devices. Deliberately coarse: it only needs to help people recognise their own devices.
 */
export function describeUserAgent(userAgent: string | undefined): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent;

  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /SamsungBrowser\//.test(ua)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS\//.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : undefined;

  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /CrOS/.test(ua)
              ? "ChromeOS"
              : /Linux/.test(ua)
                ? "Linux"
                : undefined;

  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? "Unknown device";
}
