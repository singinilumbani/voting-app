import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { publicStationConfigApi } from "@/lib/api/public-station-config";
import {
  getMobileGateSignal,
  shouldGateMobileStation,
} from "@/lib/voter/mobile-gate";
import { PublicStationProvider } from "@/components/voter/PublicStationContext";
import { MobileOnlyGate } from "@/components/voter/MobileOnlyGate";

export default async function PublicStationLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ publicId: string }>;
}>) {
  const { publicId } = await params;
  let stationConfig;
  try {
    const result = await publicStationConfigApi.getServer(publicId);
    stationConfig = result.station;
  } catch {
    notFound();
  }

  const requestHeaders = await headers();
  const signal = getMobileGateSignal(requestHeaders);
  const content = (
    <PublicStationProvider station={stationConfig}>
      {children}
    </PublicStationProvider>
  );

  if (shouldGateMobileStation(stationConfig.mobileOnly, signal)) {
    return <MobileOnlyGate signal={signal}>{content}</MobileOnlyGate>;
  }
  return content;
}
