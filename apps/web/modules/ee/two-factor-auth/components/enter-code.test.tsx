import { enableTwoFactorAuthAction } from "@/modules/ee/two-factor-auth/actions";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EnterCode } from "./enter-code";

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/modules/ee/two-factor-auth/actions", () => ({
  enableTwoFactorAuthAction: vi.fn(),
}));

describe("EnterCode", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockProps = {
    setCurrentStep: vi.fn(),
    setOpen: vi.fn(),
    refreshData: vi.fn(),
  };

  test("renders the component with correct title and description", () => {
    render(<EnterCode {...mockProps} />);

    expect(
      screen.getByText("environments.settings.profile.enable_two_factor_authentication")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.settings.profile.enter_the_code_from_your_authenticator_app_below")
    ).toBeInTheDocument();
  });

  test("handles successful code submission", async () => {
    const user = userEvent.setup();
    const mockResponse = { data: { message: "2FA enabled successfully" } };
    vi.mocked(enableTwoFactorAuthAction).mockResolvedValue(mockResponse);

    render(<EnterCode {...mockProps} />);

    // Find all input fields
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(6);

    // Enter a valid 6-digit code
    for (let i = 0; i < 6; i++) {
      await user.type(inputs[i], "1");
    }

    const confirmButton = screen.getByText("common.confirm");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(enableTwoFactorAuthAction).toHaveBeenCalledWith({ code: "111111" });
      expect(mockProps.setCurrentStep).toHaveBeenCalledWith("backupCodes");
      expect(mockProps.refreshData).toHaveBeenCalled();
    });
  });

  test("handles error during code submission", async () => {
    const user = userEvent.setup();
    const mockError = { message: "Invalid code" };
    vi.mocked(enableTwoFactorAuthAction).mockRejectedValue(mockError);

    render(<EnterCode {...mockProps} />);

    // Find all input fields
    const inputs = screen.getAllByRole("textbox");

    // Enter a valid 6-digit code
    for (let i = 0; i < 6; i++) {
      await user.type(inputs[i], "1");
    }

    const confirmButton = screen.getByText("common.confirm");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(enableTwoFactorAuthAction).toHaveBeenCalledWith({ code: "111111" });
    });
  });
});
