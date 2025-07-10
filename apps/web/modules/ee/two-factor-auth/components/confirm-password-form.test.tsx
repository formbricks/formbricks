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

// Mock the translation function
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "environments.settings.profile.two_factor_authentication": "Two-Factor Authentication",
        "environments.settings.profile.confirm_your_current_password_to_get_started":
          "Confirm your current password to get started",
        "common.password": "Password",
        "common.confirm": "Confirm",
        "common.cancel": "Cancel",
      };
      return translations[key] || key;
    },
  }),
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

    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
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

    const passwordInput = screen.getByLabelText("Password");
    await user.type(passwordInput, "testPassword123!");
    const submitButton = screen.getByRole("button", { name: "Confirm" });
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

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockProps.setOpen).toHaveBeenCalledWith(false);
  });
});
