import { z } from 'zod';

const validOrigin = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  });

const configSchema = z
  .object({
    APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    DB_DRIVER: z.enum(['pg', 'neon']).default('pg'),
    DATABASE_URL: z.string().url().optional(),
    PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    APP_BASE_URL: z.string().url().default('http://localhost:3000'),
    COOKIE_DOMAIN: z
      .string()
      .regex(/^(?:[A-Za-z0-9.-]+)?$/u)
      .default(''),
    PASSWORD_HASH_ITERATIONS: z.coerce.number().int().min(1).default(5_000),
    ENABLE_EMAIL_VERIFICATION: z.preprocess(
      (value) => (value === 'true' ? true : value === 'false' ? false : value),
      z.boolean().default(false)
    ),
    EMAIL_PROVIDER: z.enum(['console', 'brevo']).default('console'),
    BREVO_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().email().default('noreply@example.test'),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    CLOUDINARY_UPLOAD_FOLDER: z.string().default('voting-app'),
    TOKEN_HMAC_SECRET: z.string().min(32).optional(),
    SESSION_SECRET: z.string().min(32).optional(),
    PUBLIC_POLL_BALLOT_CEILING: z.coerce.number().int().min(1).default(2500),
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
  })
  .superRefine((value, context) => {
    if (value.EMAIL_PROVIDER === 'brevo' && !value.BREVO_API_KEY) {
      context.addIssue({
        code: 'custom',
        message: 'BREVO_API_KEY is required when EMAIL_PROVIDER=brevo',
        path: ['BREVO_API_KEY']
      });
    }
  });

export interface AppConfig {
  appEnv: z.infer<typeof configSchema>['APP_ENV'];
  dbDriver: z.infer<typeof configSchema>['DB_DRIVER'];
  databaseUrl?: string;
  port: number;
  appBaseUrl: string;
  cookieDomain: string;
  passwordHashIterations: number;
  enableEmailVerification: boolean;
  emailProvider: 'console' | 'brevo';
  brevoApiKey?: string;
  emailFrom: string;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  cloudinaryUploadFolder: string;
  tokenHmacSecret?: string;
  sessionSecret?: string;
  publicPollBallotCeiling: number;
  corsOrigins: string[];
}

export function loadConfig(source: unknown): AppConfig {
  const parsed = configSchema.parse(source);

  return {
    appEnv: parsed.APP_ENV,
    dbDriver: parsed.DB_DRIVER,
    ...(parsed.DATABASE_URL === undefined ? {} : { databaseUrl: parsed.DATABASE_URL }),
    port: parsed.PORT,
    appBaseUrl: parsed.APP_BASE_URL,
    cookieDomain: parsed.COOKIE_DOMAIN,
    passwordHashIterations: parsed.PASSWORD_HASH_ITERATIONS,
    enableEmailVerification: parsed.ENABLE_EMAIL_VERIFICATION,
    emailProvider: parsed.EMAIL_PROVIDER,
    ...(parsed.BREVO_API_KEY === undefined ? {} : { brevoApiKey: parsed.BREVO_API_KEY }),
    emailFrom: parsed.EMAIL_FROM,
    ...(parsed.CLOUDINARY_CLOUD_NAME === undefined
      ? {}
      : { cloudinaryCloudName: parsed.CLOUDINARY_CLOUD_NAME }),
    ...(parsed.CLOUDINARY_API_KEY === undefined
      ? {}
      : { cloudinaryApiKey: parsed.CLOUDINARY_API_KEY }),
    ...(parsed.CLOUDINARY_API_SECRET === undefined
      ? {}
      : { cloudinaryApiSecret: parsed.CLOUDINARY_API_SECRET }),
    cloudinaryUploadFolder: parsed.CLOUDINARY_UPLOAD_FOLDER,
    ...(parsed.TOKEN_HMAC_SECRET === undefined
      ? {}
      : { tokenHmacSecret: parsed.TOKEN_HMAC_SECRET }),
    ...(parsed.SESSION_SECRET === undefined ? {} : { sessionSecret: parsed.SESSION_SECRET }),
    publicPollBallotCeiling: parsed.PUBLIC_POLL_BALLOT_CEILING,
    corsOrigins: parsed.CORS_ORIGINS
  };
}
