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

/** Coarse device class of a browser (booking analytics). Tablets: iPad and Android without "Mobile". */
export function deviceClass(userAgent: string | undefined | null): "mobile" | "tablet" | "desktop" | undefined {
  if (!userAgent) return undefined;
  if (/iPad|Tablet/i.test(userAgent) || (/Android/.test(userAgent) && !/Mobile/.test(userAgent))) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) return "mobile";
  return "desktop";
}
