import { SkeletonLoader } from "@/components/ui/primitives";
import { getT } from "@/lib/i18n";

export default function BillingLoading() {
  const t = getT();
  return (
    <main className="host-page">
      <SkeletonLoader label={t("billing.loading")} count={3} />
    </main>
  );
}
