import { z } from "zod";
import { getPublicEnv } from "@/lib/env";

const apiErrorBodySchema = z.object({
  error: z
    .object({
      key: z.string().optional(),
      params: z.record(z.string(), z.unknown()).optional(),
      requestId: z.string().optional(),
    })
    .optional(),
});

export type ApiErrorDetails = Readonly<{
  key: string;
  params?: Record<string, unknown>;
  status: number;
  requestId?: string;
}>;

export class ApiError extends Error implements ApiErrorDetails {
  readonly key: string;
  readonly params?: Record<string, unknown>;
  readonly status: number;
  readonly requestId?: string;

  constructor(details: ApiErrorDetails) {
    super(details.key);
    this.name = "ApiError";
    this.key = details.key;
    this.params = details.params;
    this.status = details.status;
    this.requestId = details.requestId;
  }
}

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

function getApiBaseUrl(): string {
  const env = getPublicEnv();
  if (env.NEXT_PUBLIC_API_MODE === "direct") {
    return env.NEXT_PUBLIC_API_URL ?? "";
  }
  return typeof window === "undefined" ? "" : window.location.origin;
}

function isAbsoluteUrl(path: string): boolean {
  return path.startsWith("http://") || path.startsWith("https://");
}

function apiUrl(path: string): string {
  if (isAbsoluteUrl(path)) return path;
  const baseUrl = getApiBaseUrl();
  return baseUrl ? new URL(path, baseUrl).toString() : path;
}

async function throwApiError(response: Response): Promise<never> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  const parsed = apiErrorBodySchema.safeParse(payload);
  const bodyError = parsed.success ? parsed.data.error : undefined;
  const key = bodyError?.key ?? "errors.internal";
  const requestId =
    bodyError?.requestId ?? response.headers.get("X-Request-Id") ?? undefined;
  if (
    response.status === 401 &&
    key === "errors.auth.unauthorized" &&
    typeof window !== "undefined"
  ) {
    window.dispatchEvent(new Event("vote:session-expired"));
  }
  throw new ApiError({
    key,
    params: bodyError?.params,
    status: response.status,
    requestId,
  });
}

export async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  return apiFetchWithBase(path, schema, options);
}

export async function apiFetchWithBase<T>(
  path: string,
  schema: z.ZodType<T>,
  options: ApiRequestOptions = {},
  baseUrl?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  const { body: inputBody, ...requestOptions } = options;
  let body: BodyInit | undefined;

  if (inputBody !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(inputBody);
  }

  const response = await fetch(
    baseUrl ? new URL(path, baseUrl).toString() : apiUrl(path),
    {
      ...requestOptions,
      headers,
      body,
      credentials: "include",
    },
  );

  if (!response.ok) return throwApiError(response);
  if (response.status === 204) {
    return schema.parse(undefined);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  return schema.parse(payload);
}

export async function apiFetchText(
  path: string,
  options: Omit<RequestInit, "body"> = {},
  baseUrl?: string,
): Promise<string> {
  const headers = new Headers(options.headers);
  const response = await fetch(
    baseUrl ? new URL(path, baseUrl).toString() : apiUrl(path),
    {
      ...options,
      headers,
      credentials: "include",
    },
  );

  if (!response.ok) return throwApiError(response);
  return response.text();
}

export function apiPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}
