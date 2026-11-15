import { HostShell, SessionGate } from "@/components/host/HostPages";
import { StationWizard } from "@/components/host/StationWizard";

type EditStationPageProps = Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resume?: string }>;
}>;

export default async function EditStationPage({
  params,
  searchParams,
}: EditStationPageProps) {
  const [{ id }, { resume }] = await Promise.all([params, searchParams]);
  return (
    <SessionGate>
      <HostShell>
        <StationWizard
          initialStationId={id}
          resumeSavedDraft={resume === "1"}
        />
      </HostShell>
    </SessionGate>
  );
}
