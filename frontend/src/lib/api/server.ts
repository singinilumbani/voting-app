import { headers } from "next/headers";
import { getServerEnv } from "@/lib/env";
import {
  apiFetchWithBase,
  apiFetchText,
  type ApiRequestOptions,
} from "./client";
import type { z } from "zod";

function getServerApiBaseUrl(): string {
  const env = getServerEnv();
  const baseUrl =
    env.NEXT_PUBLIC_API_MODE === "proxy"
      ? env.API_PROXY_TARGET
      : env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error("API_PROXY_TARGET is required for server API requests.");
  }
  return baseUrl;
}

async function incomingCookieHeader(): Promise<string | undefined> {
  const requestHeaders = await headers();
  return requestHeaders.get("cookie") ?? undefined;
}

export async function serverApiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const requestHeaders = new Headers(options.headers);
  const cookie = await incomingCookieHeader();
  if (cookie) requestHeaders.set("cookie", cookie);

  return apiFetchWithBase(
    path,
    schema,
    { ...options, headers: requestHeaders },
    getServerApiBaseUrl(),
  );
}

export async function serverApiFetchText(
  path: string,
  options: ApiRequestOptions = {},
): Promise<string> {
  const requestHeaders = new Headers(options.headers);
  const cookie = await incomingCookieHeader();
  if (cookie) requestHeaders.set("cookie", cookie);

  return apiFetchText(
    path,
    { ...options, headers: requestHeaders },
    getServerApiBaseUrl(),
  );
}
