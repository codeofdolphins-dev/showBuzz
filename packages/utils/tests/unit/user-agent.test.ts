import { describe, expect, it } from "vitest";
import { describeUserAgent } from "@showbuzz/utils/user-agent";

describe("describeUserAgent", () => {
  it.each([
    [
      "Chrome on Windows",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    ],
    [
      "Safari on iPhone",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    ],
    [
      "Chrome on Android",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
    ],
    [
      "Edge on Windows",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0",
    ],
    ["Firefox on Mac", "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0"],
    [
      "Samsung Internet on Android",
      "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36",
    ],
  ])("labels %s", (label, ua) => {
    expect(describeUserAgent(ua)).toBe(label);
  });

  it("falls back for missing or unknown agents", () => {
    expect(describeUserAgent(undefined)).toBe("Unknown device");
    expect(describeUserAgent("curl/8.9.1")).toBe("Unknown device");
    expect(describeUserAgent("vitest")).toBe("Unknown device");
  });
});
