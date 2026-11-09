"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import type { HostDto } from "@/lib/api/schemas";

export const sessionQueryKey = ["host-session"] as const;

export type SessionState =
  | Readonly<{ status: "loading"; host: null }>
  | Readonly<{ status: "authenticated"; host: HostDto }>
  | Readonly<{ status: "unauthenticated"; host: null }>
  | Readonly<{ status: "error"; host: null; error: Error }>;

export function useSession(): SessionState {
  const query = useQuery({
    queryKey: sessionQueryKey,
    queryFn: authApi.me,
    retry: false,
    staleTime: 30_000,
  });

  if (query.isPending) return { status: "loading", host: null };
  if (query.isSuccess) {
    return { status: "authenticated", host: query.data.host };
  }
  if (query.error instanceof ApiError && query.error.status === 401) {
    return { status: "unauthenticated", host: null };
  }
  return {
    status: "error",
    host: null,
    error: query.error instanceof Error ? query.error : new Error(),
  };
}

export async function logout(queryClient?: ReturnType<typeof useQueryClient>) {
  await authApi.logout();
  await queryClient?.removeQueries({ queryKey: sessionQueryKey });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return () => logout(queryClient);
}
