import type { Metadata } from "next";
import { getT } from "@/lib/i18n";
import { HostProviders } from "@/components/host/HostProviders";

export const metadata: Metadata = {
  title: getT()("metadata.title"),
};

export default function HostLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <HostProviders>{children}</HostProviders>;
}
