import { verifyEmailChangeAction } from "@/modules/auth/verify-email-change/actions";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { signOut } from "next-auth/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EmailChangeSignIn } from "./email-change-sign-in";

// Mock dependencies
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

vi.mock("@/modules/auth/verify-email-change/actions", () => ({
  verifyEmailChangeAction: vi.fn(),
}));

describe("EmailChangeSignIn", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("shows loading state initially", () => {
    render(<EmailChangeSignIn token="valid-token" />);
    expect(screen.getByText("auth.email-change.email_verification_loading")).toBeInTheDocument();
  });

  test("handles successful email change verification", async () => {
    vi.mocked(verifyEmailChangeAction).mockResolvedValueOnce({
      data: {
        id: "123",
        email: "test@example.com",
        emailVerified: new Date().toISOString(),
        locale: "en-US",
      },
    });

    render(<EmailChangeSignIn token="valid-token" />);

    await waitFor(() => {
      expect(screen.getByText("auth.email-change.email_change_success")).toBeInTheDocument();
      expect(screen.getByText("auth.email-change.email_change_success_description")).toBeInTheDocument();
    });

    // Wait for the second useEffect that calls signOut to execute
    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ redirect: false });
    });
  });

  test("handles failed email change verification", async () => {
    vi.mocked(verifyEmailChangeAction).mockResolvedValueOnce({ serverError: "Error" });

    render(<EmailChangeSignIn token="invalid-token" />);

    await waitFor(() => {
      expect(screen.getByText("auth.email-change.email_verification_failed")).toBeInTheDocument();
      expect(screen.getByText("auth.email-change.invalid_or_expired_token")).toBeInTheDocument();
    });

    expect(signOut).not.toHaveBeenCalled();
  });

  test("handles empty token", () => {
    render(<EmailChangeSignIn token="" />);

    expect(screen.getByText("auth.email-change.email_verification_failed")).toBeInTheDocument();
    expect(screen.getByText("auth.email-change.invalid_or_expired_token")).toBeInTheDocument();
  });
});
