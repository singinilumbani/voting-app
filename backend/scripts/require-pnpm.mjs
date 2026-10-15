if (!process.env.npm_config_user_agent?.startsWith('pnpm')) {
  console.error('This backend requires pnpm. Install dependencies with `pnpm install`.');
  process.exit(1);
}
