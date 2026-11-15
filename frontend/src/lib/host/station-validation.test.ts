import { describe, expect, it } from "vitest";
import {
  parseVotingConfiguration,
  registrationFormSchema,
  stationBasicsSchema,
} from "./station-validation";
import type { StationWizardDraft } from "./station-draft";

const draft: StationWizardDraft = {
  step: 4,
  basics: {
    name: "District vote",
    description: "",
    mode: "CLOSED_VOTE",
    resultsVisibility: "CONCEALED",
    allowAbstain: false,
    mobileOnly: true,
  },
  registration: { voterCap: "500", durationHours: "12" },
  voting: {
    startMode: "SCHEDULED",
    startsAt: "2026-01-08T12:00",
    durationMinutes: "720",
  },
  pendingCategoryTitle: "",
  pendingCandidate: null,
};

describe("station wizard validation", () => {
  it("uses shared caps for registration and requires a station name", () => {
    expect(
      registrationFormSchema.safeParse({
        voterCap: "50000",
        durationHours: "24",
      }).success,
    ).toBe(true);
    expect(
      registrationFormSchema.safeParse({
        voterCap: "50001",
        durationHours: "24",
      }).success,
    ).toBe(false);
    expect(
      stationBasicsSchema.safeParse({ ...draft.basics, name: "  " }).success,
    ).toBe(false);
  });

  it("allows a scheduled start within seven days after registration closes", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const validDraft = {
      ...draft,
      voting: { ...draft.voting, startsAt: "2026-01-08T11:59" },
    };
    expect(parseVotingConfiguration(validDraft, now).startMode).toBe(
      "SCHEDULED",
    );
    expect(() =>
      parseVotingConfiguration(
        {
          ...validDraft,
          voting: { ...validDraft.voting, startsAt: "2026-01-09T12:01" },
        },
        now,
      ),
    ).toThrow();
  });
});
