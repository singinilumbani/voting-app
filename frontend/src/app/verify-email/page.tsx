import { VerifyEmailPage } from "@/components/auth/AuthPages";

type SearchParams = Readonly<{
  token?: string | string[];
}>;

export default async function VerifyEmailRoute({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;
  return <VerifyEmailPage token={token} />;
}
