import { StatusPage } from "@/components/global/StatusPage";
import { getT } from "@/lib/i18n";

export default function NotFound() {
  const t = getT();
  return (
    <StatusPage
      title={t("global.notFoundTitle")}
      description={t("global.notFoundDescription")}
      returnHomeLabel={t("global.returnHome")}
      icon="search_off"
    />
  );
}
