import { SkeletonLoader } from "@/components/ui/primitives";
import { getT } from "@/lib/i18n";

export default function PublicLoading() {
  const t = getT();
  return (
    <main className="voter-page">
      <SkeletonLoader label={t("voter.states.loadError")} count={2} />
    </main>
  );
}
