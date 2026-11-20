"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicStationDto } from "@/lib/api/schemas";

const PublicStationContext = createContext<PublicStationDto["station"] | null>(
  null,
);

export function PublicStationProvider({
  station,
  children,
}: Readonly<{
  station: PublicStationDto["station"];
  children: ReactNode;
}>) {
  return (
    <PublicStationContext.Provider value={station}>
      {children}
    </PublicStationContext.Provider>
  );
}

export function usePublicStation(): PublicStationDto["station"] | null {
  return useContext(PublicStationContext);
}
