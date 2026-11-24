import { ResetSuccessPage } from "@/components/auth/AuthPages";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Reset complete" };

export default function ResetSuccessRoute() {
  return <ResetSuccessPage />;
}
