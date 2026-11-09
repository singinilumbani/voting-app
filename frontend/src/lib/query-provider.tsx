"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { M3Banner } from "@/components/ui/primitives";
import { useT } from "./i18n";
import { getPublicEnv } from "./env";

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: false,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );
  const env = getPublicEnv();
  const mocksEnabled = env.NEXT_PUBLIC_ENABLE_MOCKS === "true";
  const [mockState, setMockState] = useState<"starting" | "ready" | "failed">(
    mocksEnabled ? "starting" : "ready",
  );
  const t = useT();

  useEffect(() => {
    if (!mocksEnabled) return;
    void import("./mock-worker")
      .then(({ startMockWorker }) => startMockWorker())
      .then(() => setMockState("ready"))
      .catch((error: unknown) => {
        console.error("Mock service worker initialization failed.", error);
        setMockState("failed");
      });
  }, [mocksEnabled]);

  return (
    <QueryClientProvider client={queryClient}>
      {mockState === "starting" ? (
        <p role="status">{t("global.initializingMocks")}</p>
      ) : (
        <>
          {mockState === "failed" && (
            <M3Banner variant="error">
              {t("global.mockInitializationFailed")}
            </M3Banner>
          )}
          {children}
        </>
      )}
    </QueryClientProvider>
  );
}
