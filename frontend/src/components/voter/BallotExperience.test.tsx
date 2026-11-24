import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { votingApi } from "@/lib/api/voting";
import { ApiError } from "@/lib/api/client";
import { axe } from "vitest-axe";
import { readBallotDraft } from "@/lib/voter/ballot-storage";
import { BallotExperience } from "./BallotExperience";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt || "Candidate"} />,
}));

const station = {
  publicId: "station-one",
  name: "Community election",
  mode: "CLOSED_VOTE" as const,
  status: "VOTE_OPEN",
  regStartsAt: null,
  regEndsAt: null,
  voteStartsAt: "2026-11-24T20:00:00.000Z",
  voteEndsAt: "2026-11-24T22:00:00.000Z",
  mobileOnly: false,
  allowAbstain: true,
  resultsVisibility: "CONCEALED" as const,
};

const ballot = [
  {
    id: "chair",
    title: "Chairperson",
    candidates: [
      { id: "candidate-a", name: "Candidate A", imageUrl: null },
      { id: "candidate-b", name: "Candidate B", imageUrl: null },
    ],
  },
  {
    id: "secretary",
    title: "Secretary",
    candidates: [
      { id: "candidate-c", name: "Candidate C", imageUrl: null },
    ],
  },
];

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  push.mockReset();
  vi.restoreAllMocks();
});

describe("BallotExperience", () => {
  it("has no accessibility violations", async () => {
    const { container } = render(
      <BallotExperience
        publicId="station-one"
        station={station}
        ballot={ballot}
        ballotSession="session"
        expiresAt="2099-11-24T22:00:00.000Z"
      />,
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
  it("requires exactly one choice per position and allows abstain", () => {
    render(
      <BallotExperience
        publicId="station-one"
        station={station}
        ballot={ballot}
        ballotSession="session"
        expiresAt="2099-11-24T22:00:00.000Z"
      />,
    );

    expect(screen.getByRole("button", { name: "Submit Ballot" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Candidate A/ }));
    expect(screen.getByRole("button", { name: /Candidate A/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: /Candidate B/ }));
    expect(screen.getByRole("button", { name: /Candidate A/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /Candidate B/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Abstain/ })[0]!);
    expect(screen.getAllByRole("button", { name: /Abstain/ })[0]).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("progressbar", { name: "1 of 2 positions selected" }),
    ).toBeVisible();
  });

  it("opens review, supports edit, and clears the draft after submission", async () => {
    vi.spyOn(votingApi, "submitBallot").mockResolvedValue({
      confirmation: "status.vote.submitted",
    });
    render(
      <BallotExperience
        publicId="station-one"
        station={station}
        ballot={ballot}
        ballotSession="session"
        expiresAt="2099-11-24T22:00:00.000Z"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Candidate A/ }));
    fireEvent.click(screen.getByRole("button", { name: /Candidate C/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit Ballot" }));

    expect(
      await screen.findByRole("dialog", { name: "Review your choices" }),
    ).toBeVisible();
    const dialog = await screen.findByRole("dialog", { name: "Review your choices" });
    expect(within(dialog).getByText("Candidate A")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]!);
    expect(
      screen.queryByRole("dialog", { name: "Review your choices" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Submit Ballot" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and submit" }),
    );

    await waitFor(() =>
      expect(votingApi.submitBallot).toHaveBeenCalledWith(
        "station-one",
        [
          { categoryId: "chair", candidateId: "candidate-a" },
          { categoryId: "secretary", candidateId: "candidate-c" },
        ],
        "session",
        undefined,
      ),
    );
    await waitFor(() =>
      expect(readBallotDraft("station-one")).toEqual({}),
    );
  });

  it("does not retain selections after successful submission", async () => {
    vi.spyOn(votingApi, "submitBallot").mockResolvedValue({
      confirmation: "status.vote.submitted",
    });
    render(
      <BallotExperience
        publicId="station-one"
        station={station}
        ballot={ballot}
        ballotSession="session"
        expiresAt="2099-11-24T22:00:00.000Z"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Candidate A/ }));
    fireEvent.click(screen.getByRole("button", { name: /Candidate C/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit Ballot" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and submit" }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/s/station-one/success",
      ),
    );
    expect(readBallotDraft("station-one")).toEqual({});
  });

  it.each([
    ["errors.vote.duplicate_device", "This device has already submitted a ballot."],
    ["errors.vote.capacity_reached", "The voting capacity has been reached."],
  ])("shows Public Poll submission state %s", async (key, message) => {
    vi.spyOn(votingApi, "submitBallot").mockRejectedValue(
      new ApiError({ key, status: 409 }),
    );
    render(
      <BallotExperience
        publicId="station-one"
        station={{ ...station, mode: "PUBLIC_POLL" }}
        ballot={ballot}
        deviceId="00000000-0000-4000-8000-000000000123"
        fingerprint=""
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Candidate A/ }));
    fireEvent.click(screen.getByRole("button", { name: /Candidate C/ }));
    fireEvent.click(screen.getByRole("button", { name: "Submit Ballot" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and submit" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });
});
