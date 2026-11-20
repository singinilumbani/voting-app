import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileOnlyGate } from "./MobileOnlyGate";

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

describe("MobileOnlyGate", () => {
  it("shows the mobile-required screen for desktop pointers", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 0,
    });

    render(
      <MobileOnlyGate signal="desktop">
        <p>Station content</p>
      </MobileOnlyGate>,
    );

    expect(
      screen.getByRole("heading", { name: "Mobile device required" }),
    ).toBeVisible();
  });

  it("allows a device that passes both mobile signals", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 5,
    });

    render(
      <MobileOnlyGate signal="desktop">
        <p>Station content</p>
      </MobileOnlyGate>,
    );

    expect(await screen.findByText("Station content")).toBeVisible();
  });
});
