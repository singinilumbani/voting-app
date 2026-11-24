import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BillingPage } from "./BillingPage";

vi.mock("@/lib/session", () => ({
  sessionQueryKey: ["host-session"],
  useSession: () => ({
    status: "authenticated",
    host: {
      id: "host-1",
      username: "host",
      email: "host@example.com",
      accountType: "LONG_TERM",
      plan: "FREE",
      createdAt: "2026-11-24T20:00:00.000Z",
      purgeAt: null,
      lastLoginAt: "2026-11-24T20:00:00.000Z",
    },
  }),
  useLogout: () => vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderBilling(initialStatus?: "PENDING" | "SUCCESSFUL" | "FAILED") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BillingPage initialStatus={initialStatus} />
    </QueryClientProvider>,
  );
}

describe("BillingPage", () => {
  it("shows the beta-disabled state when payments are disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PAYMENTS", "false");
    renderBilling();
    expect(
      screen.getByText("Payments are not available during the beta."),
    ).toBeVisible();
  });

  it.each([
    ["PENDING", "Pending"],
    ["SUCCESSFUL", "Successful"],
    ["FAILED", "Failed"],
  ] as const)("shows the %s payment state", (status, label) => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PAYMENTS", "true");
    renderBilling(status);
    expect(screen.getByText(label)).toBeVisible();
  });

  it("toggles monthly and annual premium options", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PAYMENTS", "true");
    renderBilling();
    fireEvent.click(screen.getByRole("button", { name: "Annual" }));
    expect(
      screen.getByText(
        "Annual institutional subscription with recurring event access.",
      ),
    ).toBeVisible();
  });

  it("offers retry for a failed payment", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_PAYMENTS", "true");
    renderBilling("FAILED");
    expect(
      screen.getByRole("button", { name: "Retry payment" }),
    ).toBeVisible();
  });
});
