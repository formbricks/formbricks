import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EmailChangeWithoutVerificationSuccessPage } from "./page";

// Mock the necessary dependencies
vi.mock("@/modules/auth/components/back-to-login-button", () => ({
  BackToLoginButton: () => <div data-testid="back-to-login">Back to Login</div>,
}));

vi.mock("@/modules/auth/components/form-wrapper", () => ({
  FormWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-wrapper">{children}</div>
  ),
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/tolgee/server", () => ({ getTranslate: () => Promise.resolve((key: string) => key) }));

describe("EmailChangeWithoutVerificationSuccessPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders success page with correct translations when user is not logged in", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const page = await EmailChangeWithoutVerificationSuccessPage();
    render(page);

    expect(screen.getByTestId("form-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("back-to-login")).toBeInTheDocument();
    expect(screen.getByText("auth.email-change.email_change_success")).toBeInTheDocument();
    expect(screen.getByText("auth.email-change.email_change_success_description")).toBeInTheDocument();
  });

  test("redirects to home page when user is logged in", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "123", email: "test@example.com" },
      expires: new Date().toISOString(),
    });

    await EmailChangeWithoutVerificationSuccessPage();

    expect(redirect).toHaveBeenCalledWith("/");
  });
});
