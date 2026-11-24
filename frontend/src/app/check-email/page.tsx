import { CheckEmailPage } from "@/components/auth/AuthPages";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Check email" };

export default function CheckEmailRoute() {
  return <CheckEmailPage />;
}
