import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  analyticsAuditSchema,
  analyticsExportSchema,
  type AnalyticsSnapshot,
} from "@/lib/api/schemas";
import { analyticsApi } from "@/lib/api/analytics";
import {
  getAnalyticsPollingInterval,
  StationAnalytics,
} from "./StationAnalytics";

const sampleSnapshot: AnalyticsSnapshot = {
  stationId: "station-analytics",
  stationName: "Community election",
  stationMode: "CLOSED_VOTE",
  status: "VOTE_OPEN",
  state: "LIVE",
  ballotsCast: 421,
  approvedVoters: 500,
  turnoutPercent: 84.2,
  possibleDuplicates: 0,
  timeRemainingSeconds: 220,
  categories: [
    {
      categoryId: "category-chair",
      title: "Chairperson",
      candidates: [
        {
          candidateId: "candidate-a",
          name: "Candidate A",
          imageUrl: null,
          count: 286,
          percentage: 68,
          isLeader: true,
          isTie: false,
        },
        {
          candidateId: "candidate-b",
          name: "Candidate B",
          imageUrl: null,
          count: 135,
          percentage: 32,
          isLeader: false,
          isTie: false,
        },
      ],
      abstentions: 0,
    },
  ],
  abstentions: 0,
  lastUpdated: new Date().toISOString(),
};

const auditEvents = [{ checkedInAt: "2026-11-20T14:00:00.000Z" }];

function renderAnalytics(
  snapshot: AnalyticsSnapshot = sampleSnapshot,
  stationStatus = "VOTE_OPEN",
) {
  vi.spyOn(analyticsApi, "snapshot").mockResolvedValue(snapshot);
  vi.spyOn(analyticsApi, "audit").mockResolvedValue({
    events: auditEvents,
    limit: 500,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StationAnalytics
        stationId="station-analytics"
        stationMode={snapshot.stationMode}
        stationStatus={stationStatus}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("station analytics", () => {
  it.each([
    ["WAITING", "REG_OPEN", "Waiting for voting to open"],
    ["LIVE", "VOTE_OPEN", "Candidate A"],
    ["FINAL", "VOTE_CLOSED", "Final results"],
  ] as const)(
    "renders the %s state",
    async (state, stationStatus, expectedText) => {
      renderAnalytics({ ...sampleSnapshot, state }, stationStatus);
      expect(await screen.findByText(expectedText)).toBeVisible();
    },
  );

  it("calculates turnout and the closed-vote ballots fraction", async () => {
    renderAnalytics();

    expect(await screen.findByText("84.2%")).toBeVisible();
    expect(screen.getByText("421 / 500")).toBeVisible();
    expect(screen.getByText("Live Connected")).toBeVisible();
    expect(screen.getByText(/Last Updated/)).toBeVisible();
    expect(
      screen.getByRole("progressbar", { name: "Turnout" }),
    ).toHaveAttribute("aria-valuenow", "84.2");
  });

  it("switches the countdown to closed when the window reaches zero", async () => {
    renderAnalytics({
      ...sampleSnapshot,
      timeRemainingSeconds: 0,
    });

    expect(await screen.findByText("Voting closed")).toBeVisible();
  });

  it("shows a ballots counter and possible duplicates for Public Poll", async () => {
    renderAnalytics({
      ...sampleSnapshot,
      stationMode: "PUBLIC_POLL",
      approvedVoters: null,
      turnoutPercent: null,
      possibleDuplicates: 3,
    });

    expect(await screen.findByText("3 possible duplicates")).toBeVisible();
    expect(screen.getAllByText("421").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("progressbar", { name: "Turnout" }),
    ).not.toBeInTheDocument();
  });

  it("shows API-marked leaders and ties", async () => {
    renderAnalytics({
      ...sampleSnapshot,
      categories: [
        {
          ...sampleSnapshot.categories[0]!,
          candidates: sampleSnapshot.categories[0]!.candidates.map(
            (candidate) => ({ ...candidate, isTie: candidate.isLeader }),
          ),
        },
      ],
    });

    expect(await screen.findByText("LEADER")).toBeVisible();
    expect(screen.getByText("Tie")).toBeVisible();
  });

  it("shows check-in timestamps and counts without voter or candidate details", async () => {
    renderAnalytics();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "View check-in activity for Chairperson",
      }),
    );
    const drawer = await screen.findByRole("region", {
      name: "Check-in activity",
    });

    expect(await within(drawer).findByText("1 check-in shown")).toBeVisible();
    expect(within(drawer).getByText(/2026/)).toHaveAttribute(
      "datetime",
      "2026-11-20T14:00:00.000Z",
    );
    expect(within(drawer).queryByText("Candidate A")).not.toBeInTheDocument();
    expect(within(drawer).queryByText("Amina Banda")).not.toBeInTheDocument();
  });

  it("strips voter identity and candidate fields from the audit response", () => {
    const parsed = analyticsAuditSchema.parse({
      events: [
        {
          voterId: "voter-private",
          fullName: "Amina Banda",
          checkedInAt: "2026-11-20T14:00:00.000Z",
          candidateName: "Candidate A",
        },
      ],
      limit: 500,
    });

    expect(parsed.events).toEqual([
      { checkedInAt: "2026-11-20T14:00:00.000Z" },
    ]);
  });

  it("backs off on API failures and stops polling while hidden or not voting", () => {
    expect(getAnalyticsPollingInterval(true, true, 0)).toBe(4_000);
    expect(getAnalyticsPollingInterval(true, true, 1)).toBe(8_000);
    expect(getAnalyticsPollingInterval(true, true, 2)).toBe(16_000);
    expect(getAnalyticsPollingInterval(true, true, 3)).toBe(30_000);
    expect(getAnalyticsPollingInterval(false, true, 0)).toBe(false);
    expect(getAnalyticsPollingInterval(true, false, 0)).toBe(false);
  });

  it("shows offline after a failed initial request and reconnecting with stale data", async () => {
    vi.spyOn(analyticsApi, "snapshot").mockRejectedValue(new Error("Offline"));
    const emptyClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const offline = render(
      <QueryClientProvider client={emptyClient}>
        <StationAnalytics
          stationId="offline-station"
          stationMode="CLOSED_VOTE"
          stationStatus="VOTE_OPEN"
        />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Offline")).toBeVisible();

    offline.unmount();
    vi.restoreAllMocks();
    vi.spyOn(analyticsApi, "snapshot").mockRejectedValue(
      new Error("Connection interrupted"),
    );
    const cachedClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    cachedClient.setQueryData(
      ["station-analytics", "station-analytics"],
      sampleSnapshot,
    );
    render(
      <QueryClientProvider client={cachedClient}>
        <StationAnalytics
          stationId="station-analytics"
          stationMode="CLOSED_VOTE"
          stationStatus="VOTE_OPEN"
        />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("Reconnecting")).toBeVisible());
  });

  it("accepts only the documented analytics CSV columns", () => {
    expect(
      analyticsExportSchema.parse(
        "category,candidate,votes,percentage,is_leader,is_tie\n",
      ),
    ).toContain("candidate");
    expect(() =>
      analyticsExportSchema.parse("category,voter,choice\n"),
    ).toThrow();
  });

  it("downloads CSV through the analytics export endpoint", async () => {
    const nativeUrl = globalThis.URL;
    const createObjectURL = vi.fn(() => "blob:station-analytics");
    const revokeObjectURL = vi.fn();
    class MockURL extends nativeUrl {
      static createObjectURL(blob: Blob): string {
        void blob;
        return createObjectURL();
      }

      static revokeObjectURL(url: string): void {
        void url;
        revokeObjectURL();
      }
    }
    vi.stubGlobal("URL", MockURL);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const exportCsv = vi
      .spyOn(analyticsApi, "exportCsv")
      .mockResolvedValue(
        "category,candidate,votes,percentage,is_leader,is_tie\n",
      );
    renderAnalytics();

    fireEvent.click(
      await screen.findByRole("button", { name: "Export reports" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));

    await waitFor(() =>
      expect(exportCsv).toHaveBeenCalledWith("station-analytics"),
    );
    expect(createObjectURL).toHaveBeenCalledOnce();
  });
});
