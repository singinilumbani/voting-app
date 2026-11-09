import { readdir, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const allowedStylesheet = resolve(sourceRoot, "styles/globals.css");
const rawHex = /#(?:[0-9a-f]{3}|[0-9a-f]{6})(?![0-9a-f])/gi;
const arbitraryColorClass =
  /\b(?:bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|shadow)-\[[^\]]+\]/g;
const findings = [];

async function inspectDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await inspectDirectory(path);
      continue;
    }

    if (path === allowedStylesheet) continue;

    const contents = await readFile(path, "utf8");
    for (const [pattern, description] of [
      [rawHex, "raw hex colour"],
      [arbitraryColorClass, "arbitrary color class"],
    ]) {
      pattern.lastIndex = 0;
      for (const match of contents.matchAll(pattern)) {
        const line = contents.slice(0, match.index).split("\n").length;
        findings.push(
          `${relative(process.cwd(), path)}:${line}: ${description}`,
        );
      }
    }
  }
}

await inspectDirectory(sourceRoot);

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Token check passed.");
}
