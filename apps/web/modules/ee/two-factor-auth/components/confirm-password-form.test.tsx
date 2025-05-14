import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ConfirmPasswordForm } from "./confirm-password-form";

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock("@/modules/ee/two-factor-auth/actions", () => ({
  setupTwoFactorAuthAction: vi.fn(),
}));

describe("ConfirmPasswordForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockProps = {
    setCurrentStep: vi.fn(),
    setBackupCodes: vi.fn(),
    setDataUri: vi.fn(),
    setSecret: vi.fn(),
    setOpen: vi.fn(),
  };

  test("renders the form with password input", () => {
    render(<ConfirmPasswordForm {...mockProps} />);

    expect(screen.getByText("environments.settings.profile.two_factor_authentication")).toBeInTheDocument();
    expect(
      screen.getByText("environments.settings.profile.confirm_your_current_password_to_get_started")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("common.password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.cancel" })).toBeInTheDocument();
  });

  test("handles form submission successfully", async () => {
    const user = userEvent.setup();
    const mockResponse = {
      data: {
        backupCodes: ["code1", "code2"],
        dataUri: "data:image/png;base64,test",
        secret: "test-secret",
        keyUri: "otpauth://totp/test",
      },
    };

    const { setupTwoFactorAuthAction } = await import("@/modules/ee/two-factor-auth/actions");
    vi.mocked(setupTwoFactorAuthAction).mockResolvedValueOnce(mockResponse);

    render(<ConfirmPasswordForm {...mockProps} />);

    const passwordInput = screen.getByLabelText("common.password");
    await user.type(passwordInput, "testPassword123!");
    const submitButton = screen.getByRole("button", { name: "common.confirm" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(setupTwoFactorAuthAction).toHaveBeenCalledWith({ password: "testPassword123!" });
      expect(mockProps.setBackupCodes).toHaveBeenCalledWith(["code1", "code2"]);
      expect(mockProps.setDataUri).toHaveBeenCalledWith("data:image/png;base64,test");
      expect(mockProps.setSecret).toHaveBeenCalledWith("test-secret");
      expect(mockProps.setCurrentStep).toHaveBeenCalledWith("scanQRCode");
    });
  });

  test("handles cancel button click", async () => {
    const user = userEvent.setup();
    render(<ConfirmPasswordForm {...mockProps} />);

    await user.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(mockProps.setOpen).toHaveBeenCalledWith(false);
  });
});
