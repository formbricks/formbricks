/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DisplayBackupCodes } from "./display-backup-codes";

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, variant, size, "data-testid": testId }: any) => (
    <button onClick={onClick} data-testid={testId} type="button">
      {children}
    </button>
  ),
}));

const translations: Record<string, string> = {
  "environments.settings.profile.enable_two_factor_authentication": "Enable Two-Factor Authentication",
  "environments.settings.profile.save_the_following_backup_codes_in_a_safe_place":
    "Save the following backup codes in a safe place",
  "common.close": "Close",
  "common.copy": "Copy",
  "common.download": "Download",
  "common.copied_to_clipboard": "Copied to clipboard",
};

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => translations[key] || key,
  }),
}));

describe("DisplayBackupCodes", () => {
  const mockBackupCodes = ["1234567890", "0987654321"];
  const mockSetOpen = vi.fn();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders component structure correctly", () => {
    render(<DisplayBackupCodes backupCodes={mockBackupCodes} setOpen={mockSetOpen} />);

    // Check main structural elements
    expect(screen.getByTestId("backup-codes-title")).toBeInTheDocument();
    expect(screen.getByTestId("backup-codes-description")).toBeInTheDocument();
    expect(screen.getByTestId("backup-codes-grid")).toBeInTheDocument();

    // Check buttons
    expect(screen.getByTestId("close-button")).toBeInTheDocument();
    expect(screen.getByTestId("copy-button")).toBeInTheDocument();
    expect(screen.getByTestId("download-button")).toBeInTheDocument();
  });

  test("displays formatted backup codes", () => {
    render(<DisplayBackupCodes backupCodes={mockBackupCodes} setOpen={mockSetOpen} />);

    mockBackupCodes.forEach((code) => {
      const formattedCode = `${code.slice(0, 5)}-${code.slice(5, 10)}`;
      const codeElement = screen.getByTestId(`backup-code-${code}`);
      expect(codeElement).toHaveTextContent(formattedCode);
    });
  });

  test("closes modal when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<DisplayBackupCodes backupCodes={mockBackupCodes} setOpen={mockSetOpen} />);

    await user.click(screen.getByTestId("close-button"));
    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });
});
