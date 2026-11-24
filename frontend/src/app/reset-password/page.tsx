import { ResetPasswordPage } from "@/components/auth/AuthPages";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Reset password" };

type SearchParams = Readonly<{
  token?: string | string[];
}>;

export default async function ResetPasswordRoute({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;
  return <ResetPasswordPage token={token} />;
}
