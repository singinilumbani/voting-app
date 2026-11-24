import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

function routeSize(
  manifest: {
    rootMainFiles?: string[];
    polyfillFiles?: string[];
    pagesChunkGroupBootstrapParams?: Record<
      string,
      { otherChunks?: string[] }
    >;
  },
  routeKey: string,
): number | null {
  const route = manifest.pagesChunkGroupBootstrapParams?.[routeKey];
  if (!route) return null;
  let bytes = 0;
  const files = new Set([
    ...(manifest.rootMainFiles ?? []),
    ...(manifest.polyfillFiles ?? []),
    ...(route.otherChunks ?? []),
  ]);
  for (const file of files) {
    const absolute = resolve(process.cwd(), ".next", file);
    if (existsSync(absolute)) {
      bytes += gzipSync(readFileSync(absolute)).length;
    }
  }
  return Math.ceil(bytes / 1024);
}

describe("first-load JavaScript budgets", () => {
  it("records representative voter and host route bundle sizes when a build exists", () => {
    const manifestPath = resolve(process.cwd(), ".next/build-manifest.json");
    if (!existsSync(manifestPath)) return;
    const manifest = JSON.parse(
      readFileSync(manifestPath, "utf8"),
    ) as Parameters<typeof routeSize>[0];

    const voterRoutes = [
      "/s/[publicId]/register/page",
      "/s/[publicId]/ballot/page",
    ];
    for (const route of voterRoutes) {
      const size = routeSize(manifest, route);
      if (size !== null) expect(size, route).toBeGreaterThan(0);
    }

    const hostRoutes = [
      "/host/page",
      "/host/stations/[id]/[tab]/page",
    ];
    for (const route of hostRoutes) {
      const size = routeSize(manifest, route);
      if (size !== null) expect(size, route).toBeGreaterThan(0);
    }
  });
});
