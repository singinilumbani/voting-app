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
  DB_DRIVER: z.enum(['pg', 'neon']).default('pg'),
  DATABASE_URL: z.string().url().optional(),
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
  dbDriver: z.infer<typeof configSchema>['DB_DRIVER'];
  databaseUrl?: string;
  port: number;
  corsOrigins: string[];
}

export function loadConfig(source: unknown): AppConfig {
  const parsed = configSchema.parse(source);

  return {
    appEnv: parsed.APP_ENV,
    dbDriver: parsed.DB_DRIVER,
    ...(parsed.DATABASE_URL === undefined ? {} : { databaseUrl: parsed.DATABASE_URL }),
    port: parsed.PORT,
    corsOrigins: parsed.CORS_ORIGINS
  };
}
