import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EnableTwoFactorModal } from "./enable-two-factor-modal";

// Mock the Modal component to expose the close functionality
vi.mock("@/modules/ui/components/modal", () => ({
  Modal: ({ children, open, setOpen }: { children: React.ReactNode; open: boolean; setOpen: () => void }) =>
    open ? (
      <div data-testid="modal">
        {children}
        <button data-testid="modal-close" onClick={setOpen}>
          Close
        </button>
      </div>
    ) : null,
}));

// Mock the child components
vi.mock("./confirm-password-form", () => ({
  ConfirmPasswordForm: ({
    setCurrentStep,
    setDataUri,
    setSecret,
  }: {
    setCurrentStep: (step: string) => void;
    setDataUri: (uri: string) => void;
    setSecret: (secret: string) => void;
  }) => (
    <div data-testid="confirm-password-form">
      <button
        onClick={() => {
          setDataUri("test-uri");
          setSecret("test-secret");
          setCurrentStep("scanQRCode");
        }}>
        Next
      </button>
    </div>
  ),
}));

vi.mock("./scan-qr-code", () => ({
  ScanQRCode: ({
    setCurrentStep,
    dataUri,
    secret,
  }: {
    setCurrentStep: (step: string) => void;
    dataUri: string;
    secret: string;
  }) => (
    <div data-testid="scan-qr-code">
      <div data-testid="data-uri">{dataUri}</div>
      <div data-testid="secret">{secret}</div>
      <button onClick={() => setCurrentStep("enterCode")}>Next</button>
    </div>
  ),
}));

vi.mock("./enter-code", () => ({
  EnterCode: ({ setCurrentStep }: { setCurrentStep: (step: string) => void }) => (
    <div data-testid="enter-code">
      <button onClick={() => setCurrentStep("backupCodes")}>Next</button>
    </div>
  ),
}));

vi.mock("./display-backup-codes", () => ({
  DisplayBackupCodes: ({ backupCodes }: { backupCodes: string[] }) => (
    <div data-testid="display-backup-codes">
      {backupCodes.map((code, index) => (
        <div key={index} data-testid={`backup-code-${index}`}>
          {code}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

describe("EnableTwoFactorModal", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders confirm password form when open", () => {
    const setOpen = vi.fn();
    render(<EnableTwoFactorModal open={true} setOpen={setOpen} />);

    expect(screen.getByTestId("confirm-password-form")).toBeInTheDocument();
  });

  test("does not render when closed", () => {
    const setOpen = vi.fn();
    render(<EnableTwoFactorModal open={false} setOpen={setOpen} />);

    expect(screen.queryByTestId("confirm-password-form")).not.toBeInTheDocument();
  });

  test("transitions through all steps correctly", async () => {
    const setOpen = vi.fn();
    const user = userEvent.setup();
    render(<EnableTwoFactorModal open={true} setOpen={setOpen} />);

    // Start at confirm password
    expect(screen.getByTestId("confirm-password-form")).toBeInTheDocument();

    // Move to scan QR code
    await user.click(screen.getByText("Next"));
    expect(screen.getByTestId("scan-qr-code")).toBeInTheDocument();
    expect(screen.getByTestId("data-uri")).toHaveTextContent("test-uri");
    expect(screen.getByTestId("secret")).toHaveTextContent("test-secret");

    // Move to enter code
    await user.click(screen.getByText("Next"));
    expect(screen.getByTestId("enter-code")).toBeInTheDocument();

    // Move to backup codes
    await user.click(screen.getByText("Next"));
    expect(screen.getByTestId("display-backup-codes")).toBeInTheDocument();
  });

  test("resets state when modal is closed", async () => {
    const setOpen = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<EnableTwoFactorModal open={true} setOpen={setOpen} />);

    // Move to scan QR code
    await user.click(screen.getByText("Next"));
    expect(screen.getByTestId("scan-qr-code")).toBeInTheDocument();

    // Close modal using the close button
    await user.click(screen.getByTestId("modal-close"));

    // Verify setOpen was called with false
    expect(setOpen).toHaveBeenCalledWith(false);

    // Reopen modal
    rerender(<EnableTwoFactorModal open={true} setOpen={setOpen} />);

    // Should be back at the first step
    expect(screen.getByTestId("confirm-password-form")).toBeInTheDocument();
  });
});
