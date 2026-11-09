import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeField } from "./CodeField";
import { PhoneField } from "./PhoneField";

describe("PhoneField", () => {
  it("normalizes on blur, previews the international number, and uses a tel keyboard", () => {
    const onNormalizedChange = vi.fn();
    render(
      <PhoneField
        label="Phone"
        defaultValue="099-123-4567"
        onNormalizedChange={onNormalizedChange}
      />,
    );

    const field = screen.getByRole("textbox", { name: "Phone" });
    expect(field).toHaveAttribute("inputmode", "tel");
    fireEvent.blur(field);

    expect(field).toHaveValue("0991 234 567");
    expect(
      screen.getByText("We will use +265 99 123 4567"),
    ).toBeInTheDocument();
    expect(onNormalizedChange).toHaveBeenCalledWith(
      expect.objectContaining({ canonical: "265991234567", ok: true }),
    );
  });

  it.each([
    ["099123456", "The phone number is too short."],
    ["099123456789", "The phone number is too long."],
    ["0212345678", "Enter a valid mobile phone number."],
    ["9.91E+11", "The phone number format is not supported."],
    ["", "Enter a phone number."],
    ["letters only", "The phone number contains invalid characters."],
  ])("shows the translated reason for %j", (value, message) => {
    render(<PhoneField label="Phone" defaultValue={value} />);
    const field = screen.getByRole("textbox", { name: "Phone" });

    fireEvent.blur(field);

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(field).toHaveAttribute("aria-invalid", "true");
  });
});

describe("CodeField", () => {
  it("formats pasted token text and reports its normalized value", () => {
    const onNormalizedChange = vi.fn();
    render(
      <CodeField label="Voter code" onNormalizedChange={onNormalizedChange} />,
    );
    const field = screen.getByRole("textbox", { name: "Voter code" });

    fireEvent.change(field, { target: { value: "k7qm 2xd9 4hnp" } });
    expect(field).toHaveValue("TK-K7QM-2XD9-4HNP");
    fireEvent.blur(field);

    expect(onNormalizedChange).toHaveBeenCalledWith({
      ok: true,
      normalized: "K7QM2XD94HNP",
    });
  });

  it("formats a pasted token with its prefix and separators", () => {
    render(<CodeField label="Voter code" />);
    const field = screen.getByRole("textbox", { name: "Voter code" });

    fireEvent.change(field, {
      target: { value: "TK-K7QM-2XD9-4HNP" },
    });

    expect(field).toHaveValue("TK-K7QM-2XD9-4HNP");
  });

  it("announces invalid token characters", () => {
    render(<CodeField label="Voter code" />);
    const field = screen.getByRole("textbox", { name: "Voter code" });

    fireEvent.change(field, { target: { value: "K7QM2XD94HN!" } });
    fireEvent.blur(field);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The token contains invalid characters.",
    );
  });
});
