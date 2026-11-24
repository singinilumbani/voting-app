import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { PaymentGateDialog } from "./PaymentGateDialog";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("PaymentGateDialog", () => {
  it("has no accessibility violations", async () => {
    const { container } = render(
      <PaymentGateDialog open onClose={() => undefined} />,
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
  it("shows payment options and continues to billing", () => {
    render(<PaymentGateDialog open onClose={() => undefined} />);
    expect(
      screen.getByRole("dialog", { name: "Payment required" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Pay-per-use" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to billing" }),
    );
    expect(push).toHaveBeenCalledWith("/host/billing");
  });
});
