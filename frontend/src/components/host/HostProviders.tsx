"use client";

import type { ReactNode } from "react";
import { AppProviders } from "@/lib/query-provider";
import { SnackbarProvider } from "@/components/ui/dialogs";

export function HostProviders({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <AppProviders>
      <SnackbarProvider>{children}</SnackbarProvider>
    </AppProviders>
  );
}
