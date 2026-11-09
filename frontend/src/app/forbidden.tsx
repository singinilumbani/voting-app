import { StatusPage } from "@/components/global/StatusPage";
import { getT } from "@/lib/i18n";

export default function Forbidden() {
  const t = getT();
  return (
    <StatusPage
      title={t("global.forbiddenTitle")}
      description={t("global.forbiddenDescription")}
      returnHomeLabel={t("global.returnHome")}
      icon="lock"
    />
  );
}
