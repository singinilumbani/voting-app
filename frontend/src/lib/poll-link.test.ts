import { describe, expect, it } from "vitest";
import { parsePollPublicId } from "./poll-link";

describe("parsePollPublicId", () => {
  it("accepts bare ids and full poll URLs", () => {
    expect(parsePollPublicId("poll_123-abc")).toBe("poll_123-abc");
    expect(parsePollPublicId("https://vote.example/s/poll_123-abc")).toBe(
      "poll_123-abc",
    );
    expect(parsePollPublicId("vote.example/s/poll_123-abc?source=share")).toBe(
      "poll_123-abc",
    );
  });

  it("rejects links that do not identify a poll route", () => {
    expect(parsePollPublicId("https://vote.example/host")).toBeUndefined();
    expect(parsePollPublicId("not a poll link")).toBeUndefined();
  });
});
