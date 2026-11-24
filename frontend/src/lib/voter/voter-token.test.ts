import { afterEach, describe, expect, it } from "vitest";
import {
  getVoterTokenStorageKey,
  readVoterToken,
  storeVoterToken,
} from "./voter-token";

afterEach(() => {
  window.localStorage.clear();
});

describe("voter token storage", () => {
  it("stores and reloads a station-scoped token", () => {
    storeVoterToken("station-one", "TK-K7QM-2XD9-4HNP");
    expect(window.localStorage.getItem(getVoterTokenStorageKey("station-one")))
      .toBe("TK-K7QM-2XD9-4HNP");
    expect(readVoterToken("station-one")).toBe("TK-K7QM-2XD9-4HNP");
  });

  it("does not read another station's token", () => {
    storeVoterToken("station-one", "TK-K7QM-2XD9-4HNP");
    expect(readVoterToken("station-two")).toBeNull();
  });
});

