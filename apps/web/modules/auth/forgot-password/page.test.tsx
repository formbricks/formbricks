import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ForgotPasswordPage } from "./page";

vi.mock("@/modules/auth/components/form-wrapper", () => ({
  FormWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="form-wrapper">{children}</div>
  ),
}));

vi.mock("@/modules/auth/forgot-password/components/forgot-password-form", () => ({
  ForgotPasswordForm: () => <div data-testid="forgot-password-form">Forgot Password Form</div>,
}));

describe("ForgotPasswordPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the forgot password page with form wrapper and form", () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByTestId("form-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("forgot-password-form")).toBeInTheDocument();
  });
});
