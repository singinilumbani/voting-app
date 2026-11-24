import { VerificationPendingPage } from "@/components/auth/AuthPages";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Verification pending" };

export default function VerifyEmailPendingRoute() {
  return <VerificationPendingPage />;
}
