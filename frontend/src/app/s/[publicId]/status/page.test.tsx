import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { votingApi } from "@/lib/api/voting";
import { storeVoterToken } from "@/lib/voter/voter-token";
import { PublicStationProvider } from "@/components/voter/PublicStationContext";
import VoterStatusPage from "./page";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

function renderStatus(status: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED" = "PENDING") {
  storeVoterToken("station-one", "TK-K7QM-2XD9-4HNP");
  vi.spyOn(votingApi, "status").mockResolvedValue({
    status,
    rejectionReason: status === "REJECTED" ? "Please correct your details." : undefined,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <PublicStationProvider
        station={{
          publicId: "station-one",
          name: "Community election",
          mode: "CLOSED_VOTE",
          status: "REG_OPEN",
          regStartsAt: null,
          regEndsAt: null,
          voteStartsAt: null,
          voteEndsAt: null,
          mobileOnly: false,
          allowAbstain: false,
          resultsVisibility: "CONCEALED",
        }}
      >
        <VoterStatusPage
          params={Promise.resolve({ publicId: "station-one" })}
        />
      </PublicStationProvider>
    </QueryClientProvider>,
  );
}

describe("VoterStatusPage", () => {
  it("checks status on open and when Check status is tapped", async () => {
    renderStatus("APPROVED");

    await waitFor(() =>
      expect(votingApi.status).toHaveBeenCalledWith(
        "station-one",
        "TK-K7QM-2XD9-4HNP",
      ),
    );
    expect(await screen.findByText("Approved")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Check status" }));
    await waitFor(() => expect(votingApi.status).toHaveBeenCalledTimes(2));
  });

  it("shows rejection reasons and a register-again link", async () => {
    renderStatus("REJECTED");
    expect(await screen.findByText("Rejected")).toBeVisible();
    expect(
      screen.getByText("Host reason: Please correct your details."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Register again" }),
    ).toHaveAttribute("href", "/s/station-one/register");
  });

  it("pauses polling while document visibility is hidden", async () => {
    let visibility: DocumentVisibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    renderStatus("PENDING");
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resolve) => window.setTimeout(resolve, 20));
    expect(setIntervalSpy).not.toHaveBeenCalled();

    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
  });
});
