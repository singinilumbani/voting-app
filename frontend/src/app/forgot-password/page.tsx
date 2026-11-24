import { ForgotPasswordPage } from "@/components/auth/AuthPages";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordRoute() {
  return <ForgotPasswordPage />;
}
