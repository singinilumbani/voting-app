import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const guardScript = resolve(process.cwd(), "scripts/require-pnpm.mjs");

describe("pnpm install guard", () => {
  it("allows pnpm", () => {
    const result = spawnSync(process.execPath, [guardScript], {
      encoding: "utf8",
      env: { ...process.env, npm_config_user_agent: "pnpm/12.4.1" },
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("rejects other package managers", () => {
    const result = spawnSync(process.execPath, [guardScript], {
      encoding: "utf8",
      env: { ...process.env, npm_config_user_agent: "npm/11.0.0" },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("This project requires pnpm.");
  });
});
