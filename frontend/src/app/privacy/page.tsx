import { LegalPlaceholder } from "@/components/auth/LegalPlaceholder";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyRoute() {
  return <LegalPlaceholder page="privacy" />;
}
