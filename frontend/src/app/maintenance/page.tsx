import { StatusPage } from "@/components/global/StatusPage";
import { getT } from "@/lib/i18n";

export default function MaintenancePage() {
  const t = getT();
  return (
    <StatusPage
      title={t("global.maintenanceTitle")}
      description={t("global.maintenanceDescription")}
      returnHomeLabel={t("global.returnHome")}
      icon="build"
    />
  );
}
