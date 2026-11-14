import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HostDto } from "@/lib/api/schemas";
import { authApi } from "@/lib/api/auth";
import { HostProfileSettings } from "./HostPages";

const host: HostDto = {
  id: "host-id",
  username: "pollhost",
  email: "host@example.test",
  accountType: "LONG_TERM",
  plan: "FREE",
  createdAt: "2026-01-01T00:00:00.000Z",
  purgeAt: null,
  lastLoginAt: "2026-11-14T00:00:00.000Z",
};

function renderSettings(initialHost: HostDto = host) {
  const onAccountDeleted = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <HostProfileSettings
        host={initialHost}
        onAccountDeleted={onAccountDeleted}
        onVerificationRequired={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return { onAccountDeleted };
}

describe("host profile tier changes", () => {
  it("requires typed DELETE confirmation to downgrade to a Temporary Account", async () => {
    const updatedHost = { ...host, accountType: "TEMPORARY" as const };
    const changeTier = vi
      .spyOn(authApi, "changeTier")
      .mockResolvedValue({ host: updatedHost });
    renderSettings();

    fireEvent.click(
      screen.getByRole("button", { name: "Change account type" }),
    );
    expect(
      screen.getByText(
        "Notice: Temporary Accounts and all associated polling data, candidate media, voter records, and election analytics will be permanently deleted 7 days after your election concludes. Please ensure you export all required reports prior to expiration.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "I understand, continue" }),
    );

    const confirmation = screen.getByRole("textbox", {
      name: "Type DELETE to confirm",
    });
    expect(
      screen.getByRole("button", { name: "Confirm change" }),
    ).toBeDisabled();
    fireEvent.change(confirmation, { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));

    await waitFor(() =>
      expect(changeTier).toHaveBeenCalledWith({
        accountType: "TEMPORARY",
        confirm: "DELETE",
      }),
    );
  });

  it("shows the Long-Term notice before upgrading", async () => {
    const temporaryHost = { ...host, accountType: "TEMPORARY" as const };
    const changeTier = vi
      .spyOn(authApi, "changeTier")
      .mockResolvedValue({ host });
    renderSettings(temporaryHost);

    fireEvent.click(
      screen.getByRole("button", { name: "Change account type" }),
    );
    expect(
      screen.getByText(
        "Notice: Your account profile will remain active indefinitely, provided you log in at least once every 6 months. Historical election results require an active Premium Package subscription to be archived permanently. Free accounts must log in periodically to prevent inactivity purging.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "I understand, continue" }),
    );

    await waitFor(() =>
      expect(changeTier).toHaveBeenCalledWith({ accountType: "LONG_TERM" }),
    );
  });
});
