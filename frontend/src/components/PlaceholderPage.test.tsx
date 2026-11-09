import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import messages from "@/locales/en.json";
import { PlaceholderPage } from "./PlaceholderPage";

describe("PlaceholderPage", () => {
  it("renders localized placeholder content", () => {
    render(
      <PlaceholderPage
        title={messages.home.title}
        description={messages.home.description}
      />,
    );

    expect(
      screen.getByRole("heading", { name: messages.home.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.home.description)).toBeInTheDocument();
  });
});
