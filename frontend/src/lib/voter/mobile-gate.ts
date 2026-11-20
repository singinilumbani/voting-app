export type MobileGateSignal = "mobile" | "desktop" | "ambiguous" | "unknown";

type HeaderReader = Readonly<{
  get(name: string): string | null;
}>;

export function isLikelyDesktop(
  headers: HeaderReader | Record<string, string | undefined>,
): boolean {
  return getMobileGateSignal(headers) === "desktop";
}

export function getMobileGateSignal(
  headers: HeaderReader | Record<string, string | undefined>,
): MobileGateSignal {
  const get = (name: string): string | null => {
    if ("get" in headers && typeof headers.get === "function") {
      return headers.get(name);
    }
    const record = headers as Record<string, string | undefined>;
    const value = record[name.toLowerCase()] ?? record[name];
    return typeof value === "string" ? value : null;
  };

  const mobileHint = get("sec-ch-ua-mobile");
  if (mobileHint !== null) {
    if (mobileHint.trim() === "?1") return "mobile";
    if (mobileHint.trim() === "?0") return "desktop";
  }

  const userAgent = get("user-agent") ?? "";
  if (!userAgent) return "unknown";

  if (/Android|iPhone|iPad|Mobile/i.test(userAgent)) return "mobile";
  if (/Windows NT|X11|CrOS/i.test(userAgent)) return "desktop";
  if (/Linux/i.test(userAgent) && !/Android/i.test(userAgent)) return "desktop";
  if (/Macintosh/i.test(userAgent)) return "ambiguous";
  return "unknown";
}

export function shouldGateMobileStation(
  mobileOnly: boolean,
  signal: MobileGateSignal,
): boolean {
  return mobileOnly && (signal === "desktop" || signal === "ambiguous");
}
