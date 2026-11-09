import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getPollingInterval, usePollingInterval } from "./polling";

describe("polling interval", () => {
  it("returns false while hidden and the configured interval while visible", () => {
    expect(getPollingInterval(false, 30_000)).toBe(false);
    expect(getPollingInterval(true, 30_000)).toBe(30_000);
    expect(getPollingInterval(true, 0)).toBe(false);
  });

  it("updates the interval when document visibility changes", () => {
    let visibility: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    const { result } = renderHook(() => usePollingInterval(15_000));
    expect(result.current).toBe(15_000);

    act(() => {
      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe(false);

    act(() => {
      visibility = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe(15_000);
  });
});
