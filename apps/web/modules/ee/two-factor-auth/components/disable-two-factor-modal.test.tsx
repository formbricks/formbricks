import { disableTwoFactorAuthAction } from "@/modules/ee/two-factor-auth/actions";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DisableTwoFactorModal } from "./disable-two-factor-modal";

vi.mock("@/modules/ee/two-factor-auth/actions", () => ({
  disableTwoFactorAuthAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe("DisableTwoFactorModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders modal with correct title and description", () => {
    render(<DisableTwoFactorModal open={true} setOpen={() => {}} />);

    expect(
      screen.getByText("environments.settings.profile.disable_two_factor_authentication")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.settings.profile.disable_two_factor_authentication_description")
    ).toBeInTheDocument();
  });

  test("shows password input field", () => {
    render(<DisableTwoFactorModal open={true} setOpen={() => {}} />);

    expect(screen.getByLabelText("common.password")).toBeInTheDocument();
  });

  test("toggles between 2FA code and backup code", async () => {
    render(<DisableTwoFactorModal open={true} setOpen={() => {}} />);

    // Initially shows 2FA code input
    expect(screen.getByText("environments.settings.profile.two_factor_code")).toBeInTheDocument();

    // Click to show backup code
    await userEvent.click(screen.getByText("environments.settings.profile.lost_access"));

    // Now shows backup code input
    expect(screen.getByText("environments.settings.profile.backup_code")).toBeInTheDocument();

    // Click to go back
    await userEvent.click(screen.getByText("common.go_back"));

    // Back to 2FA code
    expect(screen.getByText("environments.settings.profile.two_factor_code")).toBeInTheDocument();
  });

  test("submits form with 2FA code", async () => {
    const mockSetOpen = vi.fn();
    vi.mocked(disableTwoFactorAuthAction).mockResolvedValue({ data: { message: "Success" } });

    render(<DisableTwoFactorModal open={true} setOpen={mockSetOpen} />);

    // Fill in password
    await userEvent.type(screen.getByLabelText("common.password"), "testPassword123!");

    // Fill in 2FA code
    const otpInputs = screen.getAllByRole("textbox");
    for (let i = 0; i < 6; i++) {
      await userEvent.type(otpInputs[i], "1");
    }

    // Submit form
    await userEvent.click(screen.getByText("common.disable"));

    expect(disableTwoFactorAuthAction).toHaveBeenCalledWith({
      password: "testPassword123!",
      code: "111111",
      backupCode: "",
    });
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  test("submits form with backup code", async () => {
    const mockSetOpen = vi.fn();
    vi.mocked(disableTwoFactorAuthAction).mockResolvedValue({ data: { message: "Success" } });

    render(<DisableTwoFactorModal open={true} setOpen={mockSetOpen} />);

    // Fill in password
    await userEvent.type(screen.getByLabelText("common.password"), "testPassword123!");

    // Switch to backup code
    await userEvent.click(screen.getByText("environments.settings.profile.lost_access"));

    // Fill in backup code
    await userEvent.type(screen.getByPlaceholderText("XXXXX-XXXXX"), "12345-67890");

    // Submit form
    await userEvent.click(screen.getByText("common.disable"));

    expect(disableTwoFactorAuthAction).toHaveBeenCalledWith({
      password: "testPassword123!",
      code: "",
      backupCode: "12345-67890",
    });
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });
});
