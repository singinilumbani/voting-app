import { notFound } from "next/navigation";
import {
  isStationDetailTab,
  StationDetailRoute,
} from "@/components/host/StationDetail";

type StationDetailTabPageProps = Readonly<{
  params: Promise<{ id: string; tab: string }>;
}>;

export default async function StationDetailTabPage({
  params,
}: StationDetailTabPageProps) {
  const { id, tab } = await params;
  if (!isStationDetailTab(tab)) notFound();

  return <StationDetailRoute stationId={id} activeTab={tab} />;
}
