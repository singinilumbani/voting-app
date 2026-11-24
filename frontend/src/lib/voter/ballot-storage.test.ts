import { afterEach, describe, expect, it } from "vitest";
import {
  clearBallotDraft,
  clearBallotSession,
  readBallotDraft,
  readBallotSession,
  readResultsAccessToken,
  storeBallotDraft,
  storeBallotSession,
  storeResultsAccessToken,
} from "./ballot-storage";

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("ballot storage", () => {
  it("saves and restores selections and clears submitted data", () => {
    storeBallotDraft("station-one", {
      chair: "candidate-a",
      secretary: "ABSTAIN",
    });
    expect(readBallotDraft("station-one")).toEqual({
      chair: "candidate-a",
      secretary: "ABSTAIN",
    });

    clearBallotDraft("station-one");
    expect(readBallotDraft("station-one")).toEqual({});
  });

  it("keeps the ballot session in sessionStorage and clears it", () => {
    storeBallotSession(
      "station-one",
      "ballot-session",
      "2026-11-24T22:00:00.000Z",
    );
    expect(readBallotSession("station-one")).toEqual({
      ballotSession: "ballot-session",
      expiresAt: "2026-11-24T22:00:00.000Z",
    });

    clearBallotSession("station-one");
    expect(readBallotSession("station-one")).toBeNull();
  });

  it("stores only an access token for immediate results", () => {
    storeResultsAccessToken("station-one", "results-access");
    expect(readResultsAccessToken("station-one")).toBe("results-access");
  });
});
