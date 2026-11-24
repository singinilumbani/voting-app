import { VerificationVerifiedPage } from "@/components/auth/AuthPages";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Email verified" };

export default function VerifyEmailVerifiedRoute() {
  return <VerificationVerifiedPage />;
}
