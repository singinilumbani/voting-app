import { getT } from "@/lib/i18n";

export default function PublicStationPage() {
  const t = getT();
  return (
    <main className="voter-page">
      <section className="voter-page__card">
        <h1>{t("voter.station.title")}</h1>
        <p>{t("voter.station.description")}</p>
      </section>
    </main>
  );
}
