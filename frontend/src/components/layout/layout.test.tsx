import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { FloatingActionButton } from "./FloatingActionButton";

const shellLabels = {
  branding: "Voting App",
  profileHref: "/host/profile",
  profileLabel: "Profile",
  logoutLabel: "Logout",
  menuLabel: "Open menu",
  closeMenuLabel: "Close menu",
};

describe("AppShell", () => {
  it("opens and closes the mobile navigation using its button", () => {
    render(
      <AppShell {...shellLabels} onLogout={() => undefined}>
        <p>Dashboard content</p>
      </AppShell>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(
      screen.getByRole("dialog", { name: "Open menu" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("link", { name: "Profile" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dismisses the mobile navigation when the backdrop is tapped", () => {
    render(
      <AppShell {...shellLabels} onLogout={() => undefined}>
        <p>Dashboard content</p>
      </AppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement;
    if (!backdrop) throw new Error();
    fireEvent.mouseDown(backdrop);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders a desktop logout and only shows the floating action when enabled", () => {
    const onLogout = vi.fn();
    const onAction = vi.fn();
    const { rerender } = render(
      <>
        <AppShell {...shellLabels} onLogout={onLogout}>
          <p>Content</p>
        </AppShell>
        <FloatingActionButton label="Create" onClick={onAction} hidden />
      </>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Logout" })[0]!);
    expect(onLogout).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "Create" }),
    ).not.toBeInTheDocument();

    rerender(
      <>
        <AppShell {...shellLabels} onLogout={onLogout}>
          <p>Content</p>
        </AppShell>
        <FloatingActionButton label="Create" onClick={onAction} />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
