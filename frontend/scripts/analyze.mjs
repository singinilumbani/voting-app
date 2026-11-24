import { spawnSync } from "node:child_process";

const buildCommand =
  process.platform === "win32"
    ? [process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm build"]]
    : ["pnpm", ["build"]];
const analyzeCommand =
  process.platform === "win32"
    ? [process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "pnpm exec next analyze --output"]]
    : ["pnpm", ["exec", "next", "analyze", "--output"]];

for (const [command, args] of [buildCommand, analyzeCommand]) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
