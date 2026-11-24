import { ExpiredLinkPage } from "@/components/auth/AuthPages";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Reset link expired" };

export default function ResetLinkExpiredRoute() {
  return <ExpiredLinkPage />;
}
