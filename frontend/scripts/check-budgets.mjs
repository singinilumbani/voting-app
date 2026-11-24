import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

const manifestPath = resolve(process.cwd(), ".next/build-manifest.json");
if (!existsSync(manifestPath)) {
  console.log("Bundle budget check skipped: run pnpm build first.");
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function gzipKilobytes(files) {
  let bytes = 0;
  for (const file of new Set(files)) {
    const absolute = resolve(process.cwd(), ".next", file);
    if (!existsSync(absolute)) continue;
    bytes += gzipSync(readFileSync(absolute)).length;
  }
  return Math.round(bytes / 1024);
}

function routeBudget(routeKey, budgetKb) {
  const route = manifest.pagesChunkGroupBootstrapParams?.[routeKey];
  if (!route) return;
  const files = [
    ...(manifest.rootMainFiles ?? []),
    ...(manifest.polyfillFiles ?? []),
    ...(route.otherChunks ?? []),
  ];
  const kilobytes = gzipKilobytes(files);
  console.log(`${routeKey}: ${kilobytes} KB gzipped (budget ${budgetKb} KB)`);
}

routeBudget("/s/[publicId]/register/page", 130);
routeBudget("/s/[publicId]/ballot/page", 130);
routeBudget("/host/page", 220);
routeBudget("/host/stations/[id]/[tab]/page", 220);
