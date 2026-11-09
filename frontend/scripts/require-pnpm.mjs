const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm")) {
  console.error("This project requires pnpm. Run `pnpm install` instead.");
  process.exit(1);
}
