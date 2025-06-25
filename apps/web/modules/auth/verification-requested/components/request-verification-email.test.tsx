import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { resendVerificationEmailAction } from "../actions";
import { RequestVerificationEmail } from "./request-verification-email";

// Mock dependencies
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string, params?: { email?: string }) => {
      if (key === "auth.verification-requested.no_email_provided") {
        return "No email provided";
      }
      if (key === "auth.verification-requested.verification_email_resent_successfully") {
        return `Verification email sent! Please check your inbox.`;
      }
      if (key === "auth.verification-requested.resend_verification_email") {
        return "Resend verification email";
      }
      return key;
    },
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../actions", () => ({
  resendVerificationEmailAction: vi.fn(),
}));

describe("RequestVerificationEmail", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders resend verification email button", () => {
    render(<RequestVerificationEmail email="test@example.com" />);
    expect(screen.getByText("Resend verification email")).toBeInTheDocument();
  });

  test("shows error toast when no email is provided", async () => {
    render(<RequestVerificationEmail email={null} />);
    const button = screen.getByText("Resend verification email");
    await fireEvent.click(button);
    expect(toast.error).toHaveBeenCalledWith("No email provided");
  });

  test("shows success toast when verification email is sent successfully", async () => {
    const mockEmail = "test@example.com";
    vi.mocked(resendVerificationEmailAction).mockResolvedValueOnce({ data: true });

    render(<RequestVerificationEmail email={mockEmail} />);
    const button = screen.getByText("Resend verification email");
    await fireEvent.click(button);

    expect(resendVerificationEmailAction).toHaveBeenCalledWith({ email: mockEmail });
    expect(toast.success).toHaveBeenCalledWith(`Verification email sent! Please check your inbox.`);
  });

  test("reloads page when visibility changes to visible", () => {
    const mockReload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: mockReload },
      writable: true,
    });

    render(<RequestVerificationEmail email="test@example.com" />);

    // Simulate visibility change
    document.dispatchEvent(new Event("visibilitychange"));

    expect(mockReload).toHaveBeenCalled();
  });
});
