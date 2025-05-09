import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import ForgotPasswordPage from "./page";

vi.mock("@/modules/auth/forgot-password/page", () => ({
  ForgotPasswordPage: () => (
    <div data-testid="forgot-password-page">
      <div data-testid="form-wrapper">
        <div data-testid="forgot-password-form">Forgot Password Form</div>
      </div>
    </div>
  ),
}));

describe("ForgotPasswordPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the forgot password page", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId("forgot-password-page")).toBeInTheDocument();
  });

  test("renders the form wrapper", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId("form-wrapper")).toBeInTheDocument();
  });

  test("renders the forgot password form", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId("forgot-password-form")).toBeInTheDocument();
  });
});
