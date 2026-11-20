import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StationDto } from "@/lib/api/schemas";
import { stationsApi } from "@/lib/api/stations";
import { StationDetail } from "./StationDetail";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const sampleStation: StationDto = {
  id: "station-6",
  stationId: "station-6",
  publicId: "public-station-6",
  name: "Community election",
  mode: "CLOSED_VOTE",
  status: "DRAFT",
  regStartsAt: null,
  regEndsAt: null,
  voteStartsAt: null,
  voteEndsAt: null,
  resultsVisibility: "CONCEALED",
  allowAbstain: false,
  mobileOnly: true,
  voterCap: 500,
  registeredCount: 12,
  approvedVoters: 8,
  ballotsCast: 4,
  categories: [
    {
      id: "position-1",
      title: "Chairperson",
      candidates: [
        { id: "candidate-1", name: "Alice" },
        { id: "candidate-2", name: "Brian" },
      ],
    },
  ],
};

function renderDetail(
  station: StationDto,
  activeTab:
    | "overview"
    | "candidates"
    | "voters"
    | "analytics"
    | "settings" = "overview",
  activity: { eventType?: string; createdAt?: string }[] = [],
) {
  vi.spyOn(stationsApi, "get").mockResolvedValue({ station });
  vi.spyOn(stationsApi, "activityLog").mockResolvedValue({ activity });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StationDetail stationId="station-6" activeTab={activeTab} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe("station detail", () => {
  it.each([
    ["DRAFT", "Edit station"],
    ["REG_OPEN", "Extend registration"],
    ["REG_CLOSED", "Start voting"],
    ["VOTE_OPEN", "View results"],
    ["VOTE_CLOSED", "View results"],
    ["ARCHIVED", "View results"],
    ["CANCELLED", "Back to stations"],
  ])("shows the contextual primary action for %s", async (status, action) => {
    renderDetail({ ...sampleStation, status });
    expect(await screen.findByRole("button", { name: action })).toBeVisible();
  });

  it("uses each detail tab as a route segment", async () => {
    renderDetail(sampleStation);
    const tabs = await screen.findByRole("tablist", {
      name: "Polling station sections",
    });
    const candidates = within(tabs).getByRole("tab", { name: "Candidates" });
    const overview = within(tabs).getByRole("tab", { name: "Overview" });
    expect(candidates).toHaveAttribute(
      "href",
      "/host/stations/station-6/candidates",
    );
    expect(overview).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(overview, { key: "ArrowRight" });
    expect(candidates).toHaveFocus();
  });

  it("shows host activity events and filters out vote events", async () => {
    renderDetail(sampleStation, "overview", [
      {
        eventType: "CANDIDATE_ADDED",
        createdAt: "2026-11-20T08:00:00.000Z",
      },
      { eventType: "VOTE_CAST", createdAt: "2026-11-20T08:01:00.000Z" },
    ]);

    expect(await screen.findByText("A candidate was added.")).toBeVisible();
    expect(screen.queryByText("VOTE_CAST")).not.toBeInTheDocument();
  });

  it("builds the share link from the current public app address", async () => {
    renderDetail(sampleStation);
    expect(
      await screen.findByDisplayValue(
        `${window.location.origin}/s/public-station-6`,
      ),
    ).toBeVisible();
  });

  it("allows candidate create, edit, and remove only in DRAFT", async () => {
    vi.spyOn(stationsApi, "createCandidate").mockResolvedValue({
      candidate: { id: "candidate-3", name: "Chris" },
    });
    vi.spyOn(stationsApi, "updateCandidate").mockResolvedValue({
      candidate: { id: "candidate-1", name: "Alice Updated" },
    });
    vi.spyOn(stationsApi, "deleteCandidate").mockResolvedValue(undefined);
    renderDetail(sampleStation, "candidates");

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Add candidate to Chairperson",
      }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Candidate name" }), {
      target: { value: "Chris" },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }),
    );
    await waitFor(() =>
      expect(stationsApi.createCandidate).toHaveBeenCalledWith(
        "station-6",
        "position-1",
        { name: "Chris" },
      ),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit candidate Alice" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Candidate name" }), {
      target: { value: "Alice Updated" },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }),
    );
    await waitFor(() =>
      expect(stationsApi.updateCandidate).toHaveBeenCalledWith(
        "station-6",
        "candidate-1",
        { name: "Alice Updated", picture: null },
      ),
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Remove candidate Alice Updated",
      }),
    );
    const confirm = screen.getByRole("dialog", {
      name: "Remove this candidate?",
    });
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(stationsApi.deleteCandidate).toHaveBeenCalledWith(
        "station-6",
        "candidate-1",
      ),
    );
  });

  it("allows add and edit without removal during REG_OPEN", async () => {
    vi.spyOn(stationsApi, "createCandidate").mockResolvedValue({
      candidate: { id: "candidate-3", name: "Chris" },
    });
    renderDetail({ ...sampleStation, status: "REG_OPEN" }, "candidates");

    expect(
      await screen.findByRole("button", {
        name: "Add candidate to Chairperson",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Edit candidate Alice" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Remove candidate" }),
    ).not.toBeInTheDocument();
  });

  it("locks candidate controls after registration closes", async () => {
    renderDetail({ ...sampleStation, status: "REG_CLOSED" }, "candidates");

    expect(await screen.findByText(/Candidates are locked/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Add candidate to Chairperson" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit candidate Alice" }),
    ).not.toBeInTheDocument();
  });

  it("locks options after registration opens and results visibility after voting starts", async () => {
    const firstRender = renderDetail(
      { ...sampleStation, status: "REG_OPEN" },
      "settings",
    );
    const allowAbstain = await screen.findByRole("switch", {
      name: "Allow voters to abstain",
    });
    const mobileOnly = screen.getByRole("switch", {
      name: "Mobile devices only",
    });
    expect(allowAbstain).toBeDisabled();
    expect(mobileOnly).toBeDisabled();
    expect(screen.getByLabelText("Results visibility")).toBeEnabled();
    expect(
      screen.getAllByRole("button", { name: "Extend registration" }),
    ).toHaveLength(2);

    firstRender.unmount();
    vi.mocked(stationsApi.get).mockResolvedValue({
      station: { ...sampleStation, status: "VOTE_OPEN" },
    });
    renderDetail({ ...sampleStation, status: "VOTE_OPEN" }, "settings");
    expect(await screen.findByLabelText("Results visibility")).toBeDisabled();
  });

  it("only allows increasing the estimated voter count", async () => {
    vi.spyOn(stationsApi, "updateVoterCap").mockResolvedValue({
      station: { ...sampleStation, voterCap: 900 },
    });
    renderDetail(sampleStation, "settings");
    const voterCap = await screen.findByRole("spinbutton", {
      name: "New estimated voter count",
    });
    fireEvent.change(voterCap, { target: { value: "900" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() =>
      expect(stationsApi.updateVoterCap).toHaveBeenCalledWith("station-6", {
        voterCap: 900,
      }),
    );
  });

  it("extends registration only within the remaining 24-hour window", async () => {
    const started = Date.now() - 12 * 60 * 60 * 1000;
    const ended = Date.now() - 6 * 60 * 60 * 1000;
    vi.spyOn(stationsApi, "extendRegistration").mockResolvedValue({
      station: {
        ...sampleStation,
        status: "REG_OPEN",
        regStartsAt: new Date(started).toISOString(),
        regEndsAt: new Date(ended + 8 * 60 * 60 * 1000).toISOString(),
      },
    });
    renderDetail({
      ...sampleStation,
      status: "REG_OPEN",
      regStartsAt: new Date(started).toISOString(),
      regEndsAt: new Date(ended).toISOString(),
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Extend registration" }),
    );
    const field = screen.getByRole("spinbutton", {
      name: "Additional hours",
    });
    expect(field).toHaveAttribute("max", "18");
    fireEvent.change(field, { target: { value: "8" } });
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Extend registration" }),
      ).getByRole("button", { name: "Extend registration" }),
    );
    await waitFor(() =>
      expect(stationsApi.extendRegistration).toHaveBeenCalledWith("station-6", {
        additionalHours: 8,
      }),
    );
  });

  it("shows API pending-registration warning before confirming Start voting", async () => {
    const updated = { ...sampleStation, status: "VOTE_OPEN" };
    vi.spyOn(stationsApi, "configureVoting").mockResolvedValue({
      station: sampleStation,
    });
    vi.spyOn(stationsApi, "startVoting")
      .mockResolvedValueOnce({
        requiresConfirmation: true,
        warningKey: "warnings.station.pending_voters",
        pendingCount: 3,
      })
      .mockResolvedValueOnce({
        requiresConfirmation: false,
        station: updated,
        pendingCount: 3,
      });
    renderDetail({ ...sampleStation, status: "REG_CLOSED" });

    fireEvent.click(
      await screen.findByRole("button", { name: "Start voting" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Start voting" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Start voting" }),
    );
    expect(
      await within(dialog).findByText(/3 registrations are still pending/),
    ).toBeVisible();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Confirm and start voting",
      }),
    );
    await waitFor(() =>
      expect(stationsApi.startVoting).toHaveBeenNthCalledWith(
        2,
        "station-6",
        true,
      ),
    );
  });

  it("does not offer unsupported reopening actions when registration closed with no approved voters", async () => {
    vi.spyOn(stationsApi, "startVoting");
    renderDetail({
      ...sampleStation,
      status: "REG_CLOSED",
      approvedVoters: 0,
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Start voting" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "No approved voters",
    });
    expect(
      within(dialog).getByRole("button", { name: "Cancel station" }),
    ).toBeVisible();
    expect(
      within(dialog).queryByRole("button", { name: "Extend registration" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "New registration window" }),
    ).not.toBeInTheDocument();
    expect(stationsApi.startVoting).not.toHaveBeenCalled();
  });

  it("requires typing CANCEL before cancelling after voting opens", async () => {
    vi.spyOn(stationsApi, "cancel").mockResolvedValue({
      station: { ...sampleStation, status: "CANCELLED" },
    });
    renderDetail({ ...sampleStation, status: "VOTE_OPEN" }, "settings");

    fireEvent.click(
      await screen.findByRole("button", { name: "Cancel station" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Cancel this polling station?",
    });
    const confirm = within(dialog).getByRole("button", {
      name: "Cancel station",
    });
    expect(confirm).toBeDisabled();
    fireEvent.change(
      within(dialog).getByRole("textbox", {
        name: "Type CANCEL to confirm",
      }),
      { target: { value: "CANCEL" } },
    );
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(stationsApi.cancel).toHaveBeenCalledWith("station-6", "CANCEL"),
    );
  });
});
