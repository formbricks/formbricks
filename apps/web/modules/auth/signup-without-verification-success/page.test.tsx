import { SignupWithoutVerificationSuccessPage } from "@/modules/auth/signup-without-verification-success/page";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/modules/auth/components/back-to-login-button", () => ({
  BackToLoginButton: () => <div>Mocked BackToLoginButton</div>,
}));

vi.mock("@/modules/auth/components/form-wrapper", () => ({
  FormWrapper: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/modules/ui/components/alert", () => ({
  Alert: ({ children }) => <div>{children}</div>,
}));

vi.doMock("@/tolgee/server", async () => {
  const actual = await vi.importActual("@/tolgee/server");
  return {
    ...actual,
    getTranslate: vi.fn().mockResolvedValue(vi.fn((key) => key)),
  };
});

describe("SignupWithoutVerificationSuccessPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the success page correctly", async () => {
    const Page = await SignupWithoutVerificationSuccessPage();
    render(Page);

    expect(
      screen.getByText("auth.signup_without_verification_success.user_successfully_created")
    ).toBeInTheDocument();
    expect(
      screen.getByText("auth.signup_without_verification_success.user_successfully_created_description")
    ).toBeInTheDocument();
    expect(
      screen.getByText("auth.signup_without_verification_success.user_successfully_created_info")
    ).toBeInTheDocument();
    expect(screen.getByText("Mocked BackToLoginButton")).toBeInTheDocument();
  });
});
