import { StatusPage } from "@/components/global/StatusPage";
import { getT } from "@/lib/i18n";

export default function OfflinePage() {
  const t = getT();
  return (
    <StatusPage
      title={t("global.offlineTitle")}
      description={t("global.offlineDescription")}
      returnHomeLabel={t("global.returnHome")}
      icon="wifi_off"
    />
  );
}
