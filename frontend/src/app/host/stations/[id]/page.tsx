import { StationDetailRoute } from "@/components/host/StationDetail";

type StationDetailPageProps = Readonly<{
  params: Promise<{ id: string }>;
}>;

export default async function StationDetailPage({
  params,
}: StationDetailPageProps) {
  const { id } = await params;
  return <StationDetailRoute stationId={id} activeTab="overview" />;
}
