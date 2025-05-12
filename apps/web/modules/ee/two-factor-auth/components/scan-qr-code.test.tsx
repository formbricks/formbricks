import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ScanQRCode } from "./scan-qr-code";

describe("ScanQRCode", () => {
  afterEach(() => {
    cleanup();
  });

  const mockProps = {
    setCurrentStep: vi.fn(),
    dataUri: "data:image/png;base64,test",
    secret: "TEST123",
    setOpen: vi.fn(),
  };

  test("renders the component with correct title and instructions", () => {
    render(<ScanQRCode {...mockProps} />);

    expect(
      screen.getByText("environments.settings.profile.enable_two_factor_authentication")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.settings.profile.scan_the_qr_code_below_with_your_authenticator_app")
    ).toBeInTheDocument();
  });

  test("displays the QR code image", () => {
    render(<ScanQRCode {...mockProps} />);

    const qrCodeImage = screen.getByAltText("QR code");
    expect(qrCodeImage).toBeInTheDocument();
    expect(qrCodeImage).toHaveAttribute("src", mockProps.dataUri);
  });

  test("displays the secret code and copy button", () => {
    render(<ScanQRCode {...mockProps} />);

    expect(screen.getByText(mockProps.secret)).toBeInTheDocument();
    expect(
      screen.getByText("environments.settings.profile.or_enter_the_following_code_manually")
    ).toBeInTheDocument();
  });

  test("copies secret to clipboard when copy button is clicked", async () => {
    const user = userEvent.setup();
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<ScanQRCode {...mockProps} />);

    const copyButton = screen.getAllByRole("button")[0];
    await user.click(copyButton);

    expect(mockWriteText).toHaveBeenCalledWith(mockProps.secret);
  });

  test("navigates to next step when next button is clicked", async () => {
    const user = userEvent.setup();
    render(<ScanQRCode {...mockProps} />);

    const nextButton = screen.getByText("common.next");
    await user.click(nextButton);

    expect(mockProps.setCurrentStep).toHaveBeenCalledWith("enterCode");
  });

  test("closes modal when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<ScanQRCode {...mockProps} />);

    const cancelButton = screen.getByText("common.cancel");
    await user.click(cancelButton);

    expect(mockProps.setOpen).toHaveBeenCalledWith(false);
  });
});
