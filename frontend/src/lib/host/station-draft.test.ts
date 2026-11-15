import { describe, expect, it } from "vitest";
import {
  discardStationDraft,
  readStationDraft,
  saveStationDraft,
  type StationWizardDraft,
} from "./station-draft";

const draft: StationWizardDraft = {
  step: 2,
  basics: {
    name: "District vote",
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

describe("station wizard draft storage", () => {
  it("persists draft values and station id for resuming", () => {
    const storage = window.localStorage;
    saveStationDraft({ ...draft, stationId: "station-1" }, storage);

    expect(readStationDraft(storage)).toEqual({
      ...draft,
      stationId: "station-1",
    });
  });

  it("persists in-progress values and can discard a draft", () => {
    const storage = window.localStorage;
    saveStationDraft(
      {
        ...draft,
        registration: { voterCap: "50001", durationHours: "12" },
      },
      storage,
    );
    expect(readStationDraft(storage)?.registration.voterCap).toBe("50001");

    discardStationDraft(storage);
    expect(readStationDraft(storage)).toBeNull();
  });
});
