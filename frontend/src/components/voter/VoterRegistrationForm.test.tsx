import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { votingApi } from "@/lib/api/voting";
import { VoterRegistrationForm } from "./VoterRegistrationForm";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("VoterRegistrationForm", () => {
  it("registers, stores the token, and shows the received state", async () => {
    vi.spyOn(votingApi, "register").mockResolvedValue({
      token: "TK-K7QM-2XD9-4HNP",
      status: "PENDING",
    });
    render(
      <VoterRegistrationForm
        publicId="station-one"
        stationName="Community election"
        deviceId="00000000-0000-4000-8000-000000000123"
        fingerprint="fingerprint"
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Full name" }), {
      target: { value: "Amina Banda" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), {
      target: { value: "0991234567" },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Phone number" }));
    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(
      await screen.findByText("TK-K7QM-2XD9-4HNP"),
    ).toBeVisible();
    expect(screen.getByText("Waiting for host approval")).toBeVisible();
    await waitFor(() =>
      expect(votingApi.register).toHaveBeenCalledWith("station-one", {
        fullName: "Amina Banda",
        phone: "265991234567",
        deviceUuid: "00000000-0000-4000-8000-000000000123",
        fingerprintHash: "fingerprint",
      }),
    );
  });

  it.each([
    ["errors.registration.already_registered", "This number is already registered. Contact the host if you lost your token."],
    ["errors.registration.full", "The registration limit has been reached."],
    ["errors.registration.closed", "Registration is closed."],
    ["errors.registration.rate_limited", "Too many registration attempts. Try again later."],
  ])("maps %s to voter copy", async (key, message) => {
    vi.spyOn(votingApi, "register").mockRejectedValue(
      new ApiError({ key, status: 409 }),
    );
    render(
      <VoterRegistrationForm
        publicId="station-one"
        stationName="Community election"
        deviceId="00000000-0000-4000-8000-000000000123"
        fingerprint=""
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Full name" }), {
      target: { value: "Amina Banda" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), {
      target: { value: "0991234567" },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Phone number" }));
    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("shows invalid phone validation before calling the API", () => {
    const register = vi.spyOn(votingApi, "register");
    render(
      <VoterRegistrationForm
        publicId="station-one"
        stationName="Community election"
        deviceId="00000000-0000-4000-8000-000000000123"
        fingerprint=""
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Full name" }), {
      target: { value: "Amina Banda" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Phone number" }), {
      target: { value: "099123456" },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Phone number" }));
    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
      "The phone number is too short.",
    );
    expect(register).not.toHaveBeenCalled();
  });
});
