import { VerificationExpiredPage } from "@/components/auth/AuthPages";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Verification link expired" };

export default function VerificationLinkExpiredRoute() {
  return <VerificationExpiredPage />;
}
