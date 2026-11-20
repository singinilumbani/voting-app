import { describe, expect, it } from "vitest";
import {
  getMobileGateSignal,
  isLikelyDesktop,
  shouldGateMobileStation,
} from "./mobile-gate";

describe("isLikelyDesktop", () => {
  it.each([
    [
      "iPad Safari",
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    ],
    [
      "Android Chrome",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/127 Mobile Safari/537.36",
    ],
  ])("allows %s through as mobile", (_name, userAgent) => {
    expect(isLikelyDesktop({ "user-agent": userAgent })).toBe(false);
  });

  it("recognizes Windows Chrome as desktop", () => {
    expect(
      isLikelyDesktop({
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127",
      }),
    ).toBe(true);
  });

  it("passes a Mac Safari user agent to the ambiguous Layer 2 gate", () => {
    expect(
      getMobileGateSignal({
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
      }),
    ).toBe("ambiguous");
  });

  it("uses Sec-CH-UA-Mobile hints when present", () => {
    expect(
      getMobileGateSignal({
        "sec-ch-ua-mobile": "?1",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0)",
      }),
    ).toBe("mobile");
    expect(
      getMobileGateSignal({
        "sec-ch-ua-mobile": "?0",
        "user-agent": "Mozilla/5.0 (Linux; Android 14)",
      }),
    ).toBe("desktop");
  });

  it("allows unknown user agents through", () => {
    expect(getMobileGateSignal({ "user-agent": "unknown-agent" })).toBe(
      "unknown",
    );
  });

  it("recognizes plain Linux and X11 as desktop", () => {
    expect(
      isLikelyDesktop({ "user-agent": "Mozilla/5.0 X11; Linux x86_64" }),
    ).toBe(true);
  });

  it("bypasses the gate when mobile_only is false", () => {
    expect(shouldGateMobileStation(false, "desktop")).toBe(false);
  });
});
