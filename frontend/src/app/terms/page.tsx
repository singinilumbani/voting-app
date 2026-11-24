import { LegalPlaceholder } from "@/components/auth/LegalPlaceholder";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Terms of use" };

export default function TermsRoute() {
  return <LegalPlaceholder page="terms" />;
}
