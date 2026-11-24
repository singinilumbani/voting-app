"use client";

import dynamic from "next/dynamic";

const OfflineBanner = dynamic(
  () =>
    import("./OfflineBanner").then((module) => module.OfflineBanner),
  { ssr: false },
);

const SessionExpiredDialog = dynamic(
  () =>
    import("./SessionExpiredDialog").then(
      (module) => module.SessionExpiredDialog,
    ),
  { ssr: false },
);

export function LazyGlobalDialogs() {
  return (
    <>
      <OfflineBanner />
      <SessionExpiredDialog />
    </>
  );
}
