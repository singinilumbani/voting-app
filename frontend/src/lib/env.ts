import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),
  NEXT_PUBLIC_API_MODE: z.enum(["proxy", "direct"]).default("proxy"),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_ENABLE_MOCKS: z.enum(["true", "false"]).default("false"),
});

const serverEnvSchema = publicEnvSchema.extend({
  API_PROXY_TARGET: z.string().url().optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
    NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ENABLE_MOCKS: process.env.NEXT_PUBLIC_ENABLE_MOCKS,
  });

  if (!parsed.success) throw parsed.error;
  if (
    parsed.data.NEXT_PUBLIC_API_MODE === "direct" &&
    !parsed.data.NEXT_PUBLIC_API_URL
  ) {
    throw new Error("NEXT_PUBLIC_API_URL is required in direct API mode.");
  }
  return parsed.data;
}

export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
    NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ENABLE_MOCKS: process.env.NEXT_PUBLIC_ENABLE_MOCKS,
    API_PROXY_TARGET: process.env.API_PROXY_TARGET,
  });

  if (!parsed.success) throw parsed.error;
  if (
    parsed.data.NEXT_PUBLIC_API_MODE === "direct" &&
    !parsed.data.NEXT_PUBLIC_API_URL
  ) {
    throw new Error("NEXT_PUBLIC_API_URL is required in direct API mode.");
  }
  return parsed.data;
}
