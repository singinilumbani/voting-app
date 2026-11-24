import { LandingPage } from "@/components/auth/LandingPage";
import { AppProviders } from "@/lib/query-provider";

export default function HomePage() {
  return (
    <AppProviders>
      <LandingPage />
    </AppProviders>
  );
}
