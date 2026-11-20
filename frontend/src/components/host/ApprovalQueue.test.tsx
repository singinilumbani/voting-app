import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  voterExportSchema,
  votersResponseSchema,
  type VoterDto,
} from "@/lib/api/schemas";
import { votersApi } from "@/lib/api/voters";
import { ApprovalQueue } from "./ApprovalQueue";

const pendingVoter: VoterDto = {
  id: "voter-pending",
  fullName: "Amina Banda",
  phone: "099 123 4567",
  whatsappUrl: "https://wa.me/265991234567",
  status: "PENDING",
  registeredAt: "2026-11-20T08:00:00.000Z",
  hasVoted: false,
  blocked: false,
  deviceFlag: "SAME_DEVICE_AS_2",
};

const integrity = {
  approvedVoters: 1,
  ballotsCast: 1,
  abstentions: 0,
  possibleDuplicates: 0,
  alert: false,
};

function voterWithStatus(
  status: VoterDto["status"],
  overrides: Partial<VoterDto> = {},
): VoterDto {
  return {
    ...pendingVoter,
    status,
    id: `voter-${status.toLowerCase()}`,
    hasVoted: status === "VOTED",
    ...overrides,
  };
}

function listResponse(
  voters: VoterDto[],
  counts: Partial<{
    pending: number;
    approved: number;
    rejected: number;
    revoked: number;
    voted: number;
    cap: number;
  }> = {},
) {
  const defaults = {
    pending: voters.filter((voter) => voter.status === "PENDING").length,
    approved: voters.filter((voter) => voter.status === "APPROVED").length,
    rejected: voters.filter((voter) => voter.status === "REJECTED").length,
    revoked: voters.filter((voter) => voter.status === "REVOKED").length,
    voted: voters.filter((voter) => voter.status === "VOTED").length,
    cap: 500,
  };
  return {
    voters,
    counts: { ...defaults, ...counts },
    total: voters.length,
    page: 1,
    pageSize: 25,
  };
}

function renderQueue({
  status = "REG_CLOSED",
  voters = [pendingVoter],
  counts,
  integrityData = integrity,
}: {
  status?: string;
  voters?: VoterDto[];
  counts?: Parameters<typeof listResponse>[1];
  integrityData?: typeof integrity;
} = {}) {
  vi.spyOn(votersApi, "list").mockResolvedValue(listResponse(voters, counts));
  vi.spyOn(votersApi, "integrity").mockResolvedValue(integrityData);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ApprovalQueue
        stationId="station-queue"
        stationStatus={status}
        voterCap={500}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("approval queue", () => {
  it("shows names, local phone display, WhatsApp link and soft device hints", async () => {
    renderQueue({ counts: { approved: 1 } });
    const row = await screen.findByRole("article", { name: "Amina Banda" });

    expect(within(row).getByText("099 123 4567")).toBeVisible();
    expect(
      within(row).getByRole("link", { name: "Message on WhatsApp" }),
    ).toHaveAttribute("href", "https://wa.me/265991234567");
    expect(
      within(row).getByText("Same device as 2 other registrations"),
    ).toBeVisible();
    expect(screen.getByText("1 of 500")).toBeVisible();
    expect(
      screen.getByText(
        "Review registrations now. Approvals lock when voting opens.",
      ),
    ).toBeVisible();
  });

  it.each([
    [
      "PENDING",
      [
        "Approve Amina Banda",
        "Reject Amina Banda",
        "Block number for Amina Banda",
      ],
    ],
    [
      "APPROVED",
      [
        "Revoke Amina Banda",
        "Reissue token for Amina Banda",
        "Block number for Amina Banda",
      ],
    ],
    ["VOTED", ["Block number for Amina Banda"]],
    ["REJECTED", ["Block number for Amina Banda"]],
    ["REVOKED", ["Block number for Amina Banda"]],
  ] as const)(
    "shows status-appropriate row actions for %s",
    async (status, expectedActions) => {
      renderQueue({ voters: [voterWithStatus(status)] });
      const row = await screen.findByRole("article", { name: "Amina Banda" });
      for (const action of expectedActions) {
        expect(within(row).getByRole("button", { name: action })).toBeVisible();
      }
      if (status !== "PENDING") {
        expect(
          within(row).queryByRole("button", { name: "Approve Amina Banda" }),
        ).not.toBeInTheDocument();
      }
      if (status !== "APPROVED") {
        expect(
          within(row).queryByRole("button", { name: "Revoke Amina Banda" }),
        ).not.toBeInTheDocument();
      }
    },
  );

  it("approves one pending voter", async () => {
    const approve = vi
      .spyOn(votersApi, "approve")
      .mockResolvedValue({ voterId: "voter-pending", status: "APPROVED" });
    renderQueue();

    fireEvent.click(
      await screen.findByRole("button", { name: "Approve Amina Banda" }),
    );
    await waitFor(() =>
      expect(approve).toHaveBeenCalledWith("station-queue", "voter-pending"),
    );
  });

  it("revokes an eligible voter and blocks a phone number with confirmation", async () => {
    const revoke = vi
      .spyOn(votersApi, "revoke")
      .mockResolvedValue({ voterId: "voter-approved", status: "REVOKED" });
    const blockNumber = vi
      .spyOn(votersApi, "blockNumber")
      .mockResolvedValue(undefined);
    renderQueue({
      voters: [voterWithStatus("APPROVED", { id: "voter-approved" })],
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Revoke Amina Banda" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Revoke approval" }));
    await waitFor(() =>
      expect(revoke).toHaveBeenCalledWith("station-queue", "voter-approved"),
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Block number for Amina Banda",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Block number" }));
    await waitFor(() =>
      expect(blockNumber).toHaveBeenCalledWith(
        "station-queue",
        "voter-approved",
      ),
    );
  });

  it("rejects a pending voter with an optional reason", async () => {
    const reject = vi
      .spyOn(votersApi, "reject")
      .mockResolvedValue({ voterId: "voter-pending", status: "REJECTED" });
    renderQueue();

    fireEvent.click(
      await screen.findByRole("button", { name: "Reject Amina Banda" }),
    );
    fireEvent.change(screen.getByLabelText("Reason (optional)"), {
      target: { value: "Please correct your registration details." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Reject registration" }),
    );

    await waitFor(() =>
      expect(reject).toHaveBeenCalledWith(
        "station-queue",
        "voter-pending",
        "Please correct your registration details.",
      ),
    );
  });

  it("approves and rejects selected pending voters in bulk", async () => {
    const secondVoter = {
      ...pendingVoter,
      id: "voter-second",
      fullName: "Tadala Phiri",
    };
    const bulkApprove = vi
      .spyOn(votersApi, "bulkApprove")
      .mockResolvedValue({ updatedCount: 2 });
    const bulkReject = vi
      .spyOn(votersApi, "bulkReject")
      .mockResolvedValue({ updatedCount: 2 });
    renderQueue({ voters: [pendingVoter, secondVoter] });

    fireEvent.click(await screen.findByLabelText("Select Amina Banda"));
    fireEvent.click(screen.getByLabelText("Select Tadala Phiri"));
    fireEvent.click(screen.getByRole("button", { name: "Approve selected" }));
    await waitFor(() =>
      expect(bulkApprove).toHaveBeenCalledWith("station-queue", {
        voterIds: ["voter-pending", "voter-second"],
      }),
    );

    fireEvent.click(await screen.findByLabelText("Select Amina Banda"));
    fireEvent.click(screen.getByLabelText("Select Tadala Phiri"));
    fireEvent.click(screen.getByRole("button", { name: "Reject selected" }));
    fireEvent.click(
      within(
        screen.getByRole("dialog", { name: "Reject selected registrations" }),
      ).getByRole("button", { name: "Reject selected" }),
    );
    await waitFor(() =>
      expect(bulkReject).toHaveBeenCalledWith("station-queue", {
        voterIds: ["voter-pending", "voter-second"],
      }),
    );
  });

  it("confirms approve-all with the pending count", async () => {
    const bulkApprove = vi
      .spyOn(votersApi, "bulkApprove")
      .mockResolvedValue({ updatedCount: 4 });
    renderQueue({ voters: [], counts: { pending: 4 } });

    fireEvent.click(
      await screen.findByRole("button", { name: "Approve all 4 pending" }),
    );
    expect(await screen.findByText("No registrations found")).toBeVisible();
    expect(
      screen.getByText(
        "This will approve all 4 pending registrations for this station.",
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Approve all" }));

    await waitFor(() =>
      expect(bulkApprove).toHaveBeenCalledWith("station-queue", {
        allPending: true,
      }),
    );
  });

  it("locks approvals when voting opens but keeps revoke and reissue available", async () => {
    renderQueue({
      status: "VOTE_OPEN",
      voters: [
        pendingVoter,
        voterWithStatus("APPROVED", {
          id: "voter-approved",
          fullName: "Brian Phiri",
        }),
      ],
    });
    await screen.findByRole("article", { name: "Amina Banda" });

    expect(
      await screen.findByText(
        "Approvals and rejections are locked once voting opens.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Approve Amina Banda" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Reject Amina Banda" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Revoke Brian Phiri" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Reissue token for Brian Phiri" }),
    ).toBeVisible();
  });

  it("locks revoke and reissue after voting closes and explains why", async () => {
    renderQueue({
      status: "VOTE_CLOSED",
      voters: [voterWithStatus("APPROVED", { id: "voter-approved" })],
    });
    const row = await screen.findByRole("article", { name: "Amina Banda" });

    expect(
      within(row).queryByRole("button", { name: "Revoke Amina Banda" }),
    ).not.toBeInTheDocument();
    expect(
      within(row).queryByRole("button", {
        name: "Reissue token for Amina Banda",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(row).getByText(
        "Revoke and reissue are available through voting and lock when voting closes.",
      ),
    ).toBeVisible();
  });

  it("shows a reissued token only in its dialog and clears it on close", async () => {
    vi.spyOn(votersApi, "reissueToken").mockResolvedValue({
      token: "TK-ABCD-EFGH-IJKL",
    });
    renderQueue({
      voters: [voterWithStatus("APPROVED", { id: "voter-approved" })],
    });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Reissue token for Amina Banda",
      }),
    );
    expect(await screen.findByText("TK-ABCD-EFGH-IJKL")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("TK-ABCD-EFGH-IJKL")).not.toBeInTheDocument();
  });

  it("applies name and status search filters", async () => {
    const list = vi
      .spyOn(votersApi, "list")
      .mockResolvedValue(listResponse([pendingVoter]));
    vi.spyOn(votersApi, "integrity").mockResolvedValue(integrity);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ApprovalQueue stationId="station-queue" stationStatus="REG_OPEN" />
      </QueryClientProvider>,
    );

    fireEvent.change(await screen.findByLabelText("Search by name or phone"), {
      target: { value: "Amina" },
    });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filter by status" }),
      {
        target: { value: "PENDING" },
      },
    );

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith("station-queue", {
        search: "Amina",
        status: "PENDING",
        page: 1,
        pageSize: 25,
      }),
    );
  });

  it("alerts when ballots exceed approved voters even if the API alert is false", async () => {
    renderQueue({
      integrityData: {
        approvedVoters: 2,
        ballotsCast: 3,
        abstentions: 1,
        possibleDuplicates: 0,
        alert: false,
      },
    });

    expect(
      await screen.findByText(
        "3 ballots have been cast for 2 approved voters. Review this integrity alert.",
      ),
    ).toBeVisible();
  });

  it("strips unexpected token fields from voter list responses", () => {
    const parsed = votersResponseSchema.parse({
      ...listResponse([pendingVoter]),
      voters: [{ ...pendingVoter, token: "TK-SECRET-SECRET-SECR" }],
    });

    expect(parsed.voters[0]).not.toHaveProperty("token");
  });

  it("rejects WhatsApp links outside the expected secure host", () => {
    expect(() =>
      votersResponseSchema.parse({
        ...listResponse([pendingVoter]),
        voters: [
          {
            ...pendingVoter,
            whatsappUrl: "https://example.com/message",
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts only the name, phone and status CSV columns", () => {
    expect(
      voterExportSchema.parse(
        "full_name,phone_number,status\nAmina,099,APPROVED\n",
      ),
    ).toContain("phone_number");
    expect(() =>
      voterExportSchema.parse(
        "full_name,phone_number,token\nAmina,099,TK-SECRET",
      ),
    ).toThrow();
  });

  it("downloads CSV using the station export endpoint", async () => {
    const nativeUrl = globalThis.URL;
    const createObjectURL = vi.fn(() => "blob:station-voters");
    const revokeObjectURL = vi.fn();
    class MockURL extends nativeUrl {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    }
    vi.stubGlobal("URL", MockURL);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const exportCsv = vi
      .spyOn(votersApi, "exportCsv")
      .mockResolvedValue("full_name,phone_number,status\n");
    renderQueue();

    fireEvent.click(await screen.findByRole("button", { name: "Export CSV" }));

    await waitFor(() =>
      expect(exportCsv).toHaveBeenCalledWith("station-queue"),
    );
    expect(createObjectURL).toHaveBeenCalledOnce();
  });
});
