import { describe, expect, it } from "vitest";
import { getVoterEntryRoute } from "./voter-entry";

describe("getVoterEntryRoute", () => {
  it("routes Closed Vote registration and voting states", () => {
    expect(
      getVoterEntryRoute({
        publicId: "station",
        mode: "CLOSED_VOTE",
        status: "REG_OPEN",
      }),
    ).toBe("/register");
    expect(
      getVoterEntryRoute({
        publicId: "station",
        mode: "CLOSED_VOTE",
        status: "VOTE_OPEN",
      }),
    ).toBe("/ballot");
  });

  it("does not route closed phases or Public Poll registration", () => {
    expect(
      getVoterEntryRoute({
        publicId: "station",
        mode: "CLOSED_VOTE",
        status: "REG_CLOSED",
      }),
    ).toBeNull();
    expect(
      getVoterEntryRoute({
        publicId: "station",
        mode: "PUBLIC_POLL",
        status: "REG_OPEN",
      }),
    ).toBeNull();
  });

  it("routes Public Poll to the ballot only while voting is open", () => {
    expect(
      getVoterEntryRoute({
        publicId: "station",
        mode: "PUBLIC_POLL",
        status: "VOTE_OPEN",
      }),
    ).toBe("/ballot");
  });
});

