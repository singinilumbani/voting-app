import { render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicStationProvider } from "@/components/voter/PublicStationContext";
import { storeResultsAccessToken } from "@/lib/voter/ballot-storage";
import SuccessPage from "./page";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

afterEach(() => {
  window.sessionStorage.clear();
  replace.mockReset();
});

describe("VotingSuccessPage", () => {
  it("redirects immediate results when an access token is available", async () => {
    storeResultsAccessToken("station-one", "results-access");
    render(
      <PublicStationProvider
        station={{
          publicId: "station-one",
          name: "Community election",
          mode: "CLOSED_VOTE",
          status: "VOTE_CLOSED",
          regStartsAt: null,
          regEndsAt: null,
          voteStartsAt: null,
          voteEndsAt: "2026-11-24T22:00:00.000Z",
          mobileOnly: false,
          allowAbstain: false,
          resultsVisibility: "IMMEDIATE",
        }}
      >
        <Suspense fallback={null}>
          <SuccessPage params={Promise.resolve({ publicId: "station-one" })} />
        </Suspense>
      </PublicStationProvider>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/s/station-one/results?access=results-access",
      ),
    );
  });

  it("shows a concealed-results waiting message", () => {
    render(
      <PublicStationProvider
        station={{
          publicId: "station-one",
          name: "Community election",
          mode: "CLOSED_VOTE",
          status: "VOTE_OPEN",
          regStartsAt: null,
          regEndsAt: null,
          voteStartsAt: null,
          voteEndsAt: "2026-11-24T22:00:00.000Z",
          mobileOnly: false,
          allowAbstain: false,
          resultsVisibility: "CONCEALED",
        }}
      >
        <Suspense fallback={null}>
          <SuccessPage params={Promise.resolve({ publicId: "station-one" })} />
        </Suspense>
      </PublicStationProvider>,
    );
    expect(
      screen.getByText("Results will be available when voting ends."),
    ).toBeVisible();
  });
});
