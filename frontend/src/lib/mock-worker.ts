export async function startMockWorker(): Promise<void> {
  if (typeof window === "undefined") return;
  const { worker } = await import("@/mocks/browser");
  await worker.start({ onUnhandledFrame: "bypass" });
}
