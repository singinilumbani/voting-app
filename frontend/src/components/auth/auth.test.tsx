import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthDialog } from "./AuthDialog";
import { ForgotPasswordPage, ResetPasswordPage } from "./AuthPages";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";

const { push, replace } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

function renderWithClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function renderAuthDialog() {
  const onAuthenticated = vi.fn();
  const onVerificationRequired = vi.fn();
  renderWithClient(
    <AuthDialog
      open
      onClose={vi.fn()}
      onAuthenticated={onAuthenticated}
      onVerificationRequired={onVerificationRequired}
    />,
  );
  return { onAuthenticated, onVerificationRequired };
}

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
});

describe("host auth dialog", () => {
  it("shows each account-tier notice with its exact specification text", () => {
    renderAuthDialog();
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    fireEvent.click(screen.getByRole("button", { name: /Temporary Account/ }));
    expect(
      screen.getByText(
        "Notice: Temporary Accounts and all associated polling data, candidate media, voter records, and election analytics will be permanently deleted 7 days after your election concludes. Please ensure you export all required reports prior to expiration.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    fireEvent.click(screen.getByRole("button", { name: /Long-Term Account/ }));
    expect(
      screen.getByText(
        "Notice: Your account profile will remain active indefinitely, provided you log in at least once every 6 months. Historical election results require an active Premium Package subscription to be archived permanently. Free accounts must log in periodically to prevent inactivity purging.",
      ),
    ).toBeInTheDocument();
  });

  it("validates the two-step signup form and creates the selected account", async () => {
    const signup = vi.spyOn(authApi, "signup").mockResolvedValue({
      accountType: "TEMPORARY",
      verificationRequired: false,
    });
    const { onAuthenticated } = renderAuthDialog();
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    fireEvent.click(screen.getByRole("button", { name: /Temporary Account/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "I understand, continue" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      screen.getByText("Use 3 to 80 letters or numbers for your username."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You must accept the Terms of Use and Privacy Policy."),
    ).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "pollhost" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "host@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "I accept the" }));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(signup).toHaveBeenCalledWith({
        username: "pollhost",
        email: "host@example.test",
        password: "StrongPassword123!",
        accountType: "TEMPORARY",
        termsAccepted: true,
      }),
    );
    expect(onAuthenticated).toHaveBeenCalledOnce();
  });

  it("maps sign-in failures from API message keys to localized copy", async () => {
    const login = vi.spyOn(authApi, "login").mockRejectedValue(
      new ApiError({
        key: "errors.host_auth.invalid_credentials",
        status: 401,
      }),
    );
    renderAuthDialog();
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "pollhost" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The username or password is incorrect.",
    );
    expect(login).toHaveBeenCalledOnce();
  });

  it("shows verification-pending only when signup returns the verification-required status", async () => {
    vi.spyOn(authApi, "signup").mockResolvedValue({
      accountType: "LONG_TERM",
      verificationRequired: true,
    });
    const { onAuthenticated, onVerificationRequired } = renderAuthDialog();
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));
    fireEvent.click(screen.getByRole("button", { name: /Long-Term Account/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "I understand, continue" }),
    );
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "pollhost" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "host@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "I accept the" }));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(onVerificationRequired).toHaveBeenCalledWith("host@example.test"),
    );
    expect(onAuthenticated).not.toHaveBeenCalled();
  });
});

describe("host password recovery", () => {
  it("submits a neutral forgot-password request and opens the confirmation page", async () => {
    const forgot = vi.spyOn(authApi, "forgotPassword").mockResolvedValue({
      messageKey: "status.host_auth.password_reset_if_exists",
    });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "someone@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(forgot).toHaveBeenCalledWith("someone@example.test"),
    );
    expect(push).toHaveBeenCalledWith("/check-email");
  });

  it("validates an email before sending a forgot-password request", () => {
    const forgot = vi.spyOn(authApi, "forgotPassword");
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid email address.",
    );
    expect(forgot).not.toHaveBeenCalled();
  });

  it("submits a matching new password and opens the success page", async () => {
    const reset = vi
      .spyOn(authApi, "resetPassword")
      .mockResolvedValue({ messageKey: "status.host_auth.password_reset" });
    render(<ResetPasswordPage token="one-time-token" />);
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    await waitFor(() =>
      expect(reset).toHaveBeenCalledWith({
        token: "one-time-token",
        password: "StrongPassword123!",
      }),
    );
    expect(push).toHaveBeenCalledWith("/reset-success");
  });
});
