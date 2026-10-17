import { z } from 'zod';

const validOrigin = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  });

const configSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    )
    .pipe(z.array(validOrigin).min(1))
});

export interface AppConfig {
  appEnv: z.infer<typeof configSchema>['APP_ENV'];
  port: number;
  corsOrigins: string[];
}

export function loadConfig(source: unknown): AppConfig {
  const parsed = configSchema.parse(source);

  return {
    appEnv: parsed.APP_ENV,
    port: parsed.PORT,
    corsOrigins: parsed.CORS_ORIGINS
  };
}
