import type { Metadata } from "next";
import { BillingPage } from "@/components/host/BillingPage";
import { getT } from "@/lib/i18n";

export const metadata: Metadata = {
  title: getT()("billing.title"),
};

export default function HostBillingRoute() {
  return <BillingPage />;
}
