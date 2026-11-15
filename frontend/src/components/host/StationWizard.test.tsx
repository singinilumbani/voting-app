import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StationDto } from "@/lib/api/schemas";
import { stationsApi } from "@/lib/api/stations";
import {
  readStationDraft,
  saveStationDraft,
  type StationWizardDraft,
} from "@/lib/host/station-draft";
import { StationWizard } from "./StationWizard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const emptyStation: StationDto = {
  id: "station-1",
  stationId: "station-1",
  publicId: "public-1",
  name: "Community election",
  description: null,
  mode: "PUBLIC_POLL",
  status: "DRAFT",
  mobileOnly: false,
  allowAbstain: false,
  resultsVisibility: "CONCEALED",
  categories: [],
};

const savedDraft: StationWizardDraft = {
  stationId: "station-1",
  step: 1,
  basics: {
    name: "Community election",
    description: "",
    mode: "CLOSED_VOTE",
    resultsVisibility: "CONCEALED",
    allowAbstain: false,
    mobileOnly: true,
  },
  registration: { voterCap: "500", durationHours: "12" },
  voting: { startMode: "NOW", startsAt: "", durationMinutes: "720" },
  pendingCategoryTitle: "",
  pendingCandidate: null,
};

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(stationsApi, "create").mockResolvedValue({ station: emptyStation });
  vi.spyOn(stationsApi, "update").mockResolvedValue({ station: emptyStation });
  vi.spyOn(stationsApi, "configureVoting").mockResolvedValue({
    station: emptyStation,
  });
  vi.spyOn(stationsApi, "configureRegistration").mockResolvedValue({
    station: emptyStation,
  });
  vi.spyOn(stationsApi, "launch").mockResolvedValue({
    station: { ...emptyStation, status: "VOTE_OPEN" },
    publicId: "public-1",
    shareLink: "https://example.test/s/public-1",
  });
  vi.spyOn(stationsApi, "createCategory").mockResolvedValue({
    category: { id: "category-1", title: "Chairperson", candidates: [] },
  });
  vi.spyOn(stationsApi, "createCandidate")
    .mockResolvedValueOnce({
      candidate: { id: "candidate-1", name: "Candidate One" },
    })
    .mockResolvedValueOnce({
      candidate: { id: "candidate-2", name: "Candidate Two" },
    });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("polling station wizard", () => {
  it("validates station basics and skips Registration for a Public Poll", async () => {
    const { container } = render(<StationWizard />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findAllByText("Enter a station name.")).toHaveLength(1);

    fireEvent.change(screen.getByRole("textbox", { name: "Station name" }), {
      target: { value: "Community election" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Positions")).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("textbox", { name: "Position or category name" }),
      {
        target: { value: "Chairperson" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Add position" }));
    expect(
      await screen.findByRole("heading", { name: "Chairperson" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const addCandidate = await screen.findByRole("button", {
      name: "Add candidate to Chairperson",
    });
    fireEvent.click(addCandidate);
    fireEvent.change(screen.getByRole("textbox", { name: "Candidate name" }), {
      target: { value: "Candidate One" },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }),
    );
    expect(await screen.findByText("Candidate One")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Add candidate to Chairperson" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Candidate name" }), {
      target: { value: "Candidate Two" },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }),
    );
    expect(await screen.findByText("Candidate Two")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(
      await screen.findByRole("heading", { name: "Voting Window" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Registration")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Review and launch" }));
    const launchDialog = await screen.findByRole("dialog", {
      name: "Launch polling station?",
    });
    fireEvent.click(
      within(launchDialog).getByRole("button", {
        name: "Launch Polling Station",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Polling station launched" }),
    ).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(stationsApi.configureVoting).toHaveBeenCalledWith(
      "station-1",
      expect.objectContaining({ startMode: "NOW", durationMinutes: 720 }),
    );
  });

  it("offers resume and discard for a saved browser draft", async () => {
    saveStationDraft(savedDraft);
    vi.spyOn(stationsApi, "get").mockResolvedValue({ station: emptyStation });
    render(<StationWizard />);

    const prompt = await screen.findByRole("dialog", {
      name: "Resume or discard draft",
    });
    fireEvent.click(
      within(prompt).getByRole("button", { name: "Resume draft" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Positions" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(readStationDraft()?.step).toBe(1));
  });

  it("discards local progress without deleting the server station", async () => {
    saveStationDraft(savedDraft);
    render(<StationWizard />);
    const prompt = await screen.findByRole("dialog", {
      name: "Resume or discard draft",
    });
    fireEvent.click(
      within(prompt).getByRole("button", { name: "Discard draft" }),
    );

    expect(
      await screen.findByRole("textbox", { name: "Station name" }),
    ).toHaveValue("");
    expect(readStationDraft()).toBeNull();
  });
});
