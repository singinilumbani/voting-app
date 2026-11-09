import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const localePath = resolve(sourceRoot, "locales/en.json");
const messages = JSON.parse(await readFile(localePath, "utf8"));
const sourceFiles = [];
const usedKeys = [];
const warnings = [];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(path);
    } else if (/\.(?:tsx|ts|jsx|js)$/.test(entry.name)) {
      sourceFiles.push(path);
    }
  }
}

function getNestedValue(root, key) {
  let value = root;
  for (const part of key.split(".")) {
    if (
      typeof value !== "object" ||
      value === null ||
      !Object.hasOwn(value, part)
    ) {
      return undefined;
    }
    value = value[part];
  }
  return value;
}

await collectFiles(sourceRoot);

for (const path of sourceFiles) {
  const source = await readFile(path, "utf8");
  const translators = new Set(
    Array.from(
      source.matchAll(
        /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:useT|getT)\s*\(\s*\)/g,
      ),
      (match) => match[1],
    ),
  );

  for (const translator of translators) {
    const callPattern = new RegExp(
      `\\b${translator}\\s*\\(\\s*["']([\\w.-]+)["']`,
      "g",
    );
    for (const match of source.matchAll(callPattern)) {
      usedKeys.push({ key: match[1], path });
    }
  }

  if (!/\.(?:test|spec)\.[jt]sx?$/.test(path)) {
    const jsxText = />\s*([A-Za-z][^<>{}\n]*)\s*</g;
    for (const match of source.matchAll(jsxText)) {
      const text = match[1].trim();
      if (text && !/^(?:\{.*\}|<\/?)/.test(text)) {
        warnings.push(
          `${relative(process.cwd(), path)}: possible hard-coded JSX text: ${text}`,
        );
      }
    }
    const literalAttributes =
      /\b(?:aria-label|placeholder|title)\s*=\s*["']([^"']*[A-Za-z][^"']*)["']/g;
    for (const match of source.matchAll(literalAttributes)) {
      warnings.push(
        `${relative(process.cwd(), path)}: possible hard-coded JSX attribute: ${match[1]}`,
      );
    }
  }
}

const missing = usedKeys.filter(
  ({ key }) => getNestedValue(messages, key) === undefined,
);

if (missing.length > 0) {
  console.error(
    missing
      .map(
        ({ key, path }) =>
          `${relative(process.cwd(), path)}: missing translation key "${key}"`,
      )
      .join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    `Translation key check passed (${usedKeys.length} keys checked).`,
  );
}

if (warnings.length > 0) {
  console.warn(warnings.join("\n"));
}
