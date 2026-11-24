import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TokenDisplay } from "./TokenDisplay";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TokenDisplay", () => {
  it("copies the token and shows copied feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<TokenDisplay token="TK-K7QM-2XD9-4HNP" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy Token" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("TK-K7QM-2XD9-4HNP"),
    );
    expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();
  });

  it("falls back to clipboard when Web Share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    render(<TokenDisplay token="TK-K7QM-2XD9-4HNP" />);

    fireEvent.click(screen.getByRole("button", { name: "Save or Share" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("TK-K7QM-2XD9-4HNP"),
    );
  });

  it("announces clipboard failure as a message-key fallback", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    render(<TokenDisplay token="TK-K7QM-2XD9-4HNP" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy Token" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The token could not be copied.",
    );
  });

  it("uses the Web Share API when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    render(<TokenDisplay token="TK-K7QM-2XD9-4HNP" />);

    fireEvent.click(screen.getByRole("button", { name: "Save or Share" }));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: "My polling station voter token",
        text: "TK-K7QM-2XD9-4HNP",
      }),
    );
  });
});
