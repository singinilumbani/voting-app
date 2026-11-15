import { HostShell, SessionGate } from "@/components/host/HostPages";
import { StationWizard } from "@/components/host/StationWizard";

type NewStationPageProps = Readonly<{
  searchParams: Promise<{ resume?: string }>;
}>;

export default async function NewStationPage({
  searchParams,
}: NewStationPageProps) {
  const { resume } = await searchParams;
  return (
    <SessionGate>
      <HostShell>
        <StationWizard resumeSavedDraft={resume === "1"} />
      </HostShell>
    </SessionGate>
  );
}
