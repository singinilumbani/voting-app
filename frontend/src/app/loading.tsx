import { SkeletonLoader } from "@/components/ui/primitives";
import { getT } from "@/lib/i18n";

export default function AppLoading() {
  const t = getT();
  return (
    <main className="global-status-page">
      <SkeletonLoader label={t("global.loadingPage")} count={2} />
    </main>
  );
}
