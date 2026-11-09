import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getT, useT } from "./i18n";

describe("translation helpers", () => {
  it("interpolates named placeholders", () => {
    expect(getT()("translationExamples.greeting", { name: "Ada" })).toBe(
      "Hello, Ada.",
    );
  });

  it("selects plural forms with Intl.PluralRules", () => {
    const t = getT();
    expect(t("translationExamples.voterCount", { count: 1 })).toBe("1 voter");
    expect(t("translationExamples.voterCount", { count: 3 })).toBe("3 voters");
  });

  it("warns and returns the key for missing translations in development", () => {
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    expect(getT()("errors.missing.example")).toBe("errors.missing.example");
    expect(warning).toHaveBeenCalledWith(
      "Missing translation: errors.missing.example",
    );
  });

  it("exposes a hook helper for client components", () => {
    function Greeting() {
      const t = useT();
      return <p>{t("translationExamples.greeting", { name: "Ada" })}</p>;
    }

    render(<Greeting />);
    expect(screen.getByText("Hello, Ada.")).toBeInTheDocument();
  });
});
