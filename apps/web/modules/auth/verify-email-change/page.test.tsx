import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { VerifyEmailChangePage } from "./page";

// Mock the necessary dependencies
vi.mock("@/modules/auth/components/back-to-login-button", () => ({
  BackToLoginButton: () => <div data-testid="back-to-login">Back to Login</div>,
}));

vi.mock("@/modules/auth/components/form-wrapper", () => ({
  FormWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-wrapper">{children}</div>
  ),
}));

vi.mock("@/modules/auth/verify-email-change/components/email-change-sign-in", () => ({
  EmailChangeSignIn: ({ token }: { token: string }) => (
    <div data-testid="email-change-sign-in">Email Change Sign In with token: {token}</div>
  ),
}));

describe("VerifyEmailChangePage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the page with form wrapper and components", async () => {
    const searchParams = { token: "test-token" };
    render(await VerifyEmailChangePage({ searchParams }));

    expect(screen.getByTestId("form-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("email-change-sign-in")).toBeInTheDocument();
    expect(screen.getByTestId("back-to-login")).toBeInTheDocument();
    expect(screen.getByText("Email Change Sign In with token: test-token")).toBeInTheDocument();
  });

  test("handles missing token", async () => {
    const searchParams = {};
    render(await VerifyEmailChangePage({ searchParams }));

    expect(screen.getByTestId("form-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("email-change-sign-in")).toBeInTheDocument();
    expect(screen.getByTestId("back-to-login")).toBeInTheDocument();
  });
});
