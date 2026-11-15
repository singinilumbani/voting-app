import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HostDto, StationDto } from "@/lib/api/schemas";
import { stationsApi } from "@/lib/api/stations";
import { StationDashboard } from "./StationDashboard";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const sampleStation: StationDto = {
  id: "station-1",
  stationId: "station-1",
  publicId: "public-1",
  name: "Community election",
  mode: "CLOSED_VOTE",
  status: "REG_OPEN",
  regStartsAt: "2026-11-14T20:00:00.000Z",
  regEndsAt: "2026-11-15T08:00:00.000Z",
  voteStartsAt: null,
  voteEndsAt: null,
  registeredCount: 34,
  ballotsCast: 0,
};

const longTermHost: HostDto = {
  id: "host-1",
  username: "host",
  email: "host@example.test",
  accountType: "LONG_TERM",
  plan: "FREE",
  createdAt: "2026-01-01T00:00:00.000Z",
  purgeAt: null,
  lastLoginAt: null,
};

function renderDashboard(host: HostDto = longTermHost) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StationDashboard host={host} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("station dashboard", () => {
  it("passes selected filters and search text to the stations API", async () => {
    const list = vi
      .spyOn(stationsApi, "list")
      .mockResolvedValue({ stations: [sampleStation] });
    renderDashboard();

    expect(await screen.findByText("Community election")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Active" }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({
        filter: "Active",
        search: "",
      }),
    );

    const searchField = await screen.findByRole("textbox", {
      name: "Search polling stations",
    });
    fireEvent.change(searchField, { target: { value: "community" } });
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({
        filter: "Active",
        search: "community",
      }),
    );
    expect(await screen.findByText("34 voters registered")).toBeInTheDocument();
  });

  it("shows account purge, inactivity, and payment warnings", async () => {
    vi.spyOn(stationsApi, "list").mockResolvedValue({
      stations: [sampleStation],
    });
    const temporaryHost = {
      ...longTermHost,
      accountType: "TEMPORARY" as const,
      plan: "PAYMENT_REQUIRED",
      purgeAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    };
    const { rerender } = renderDashboard(temporaryHost);

    expect(
      await screen.findByText(
        /temporary account and its data will be deleted in 2 days/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Payment is required before this polling station can open.",
      ),
    ).toBeInTheDocument();

    const inactiveHost = {
      ...longTermHost,
      lastLoginAt: new Date(Date.now() - 160 * 86_400_000).toISOString(),
    };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    rerender(
      <QueryClientProvider client={queryClient}>
        <StationDashboard host={inactiveHost} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/inactive for five months/i)).toBeInTheDocument();
  });
});
