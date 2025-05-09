import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ResetPasswordSuccessPage } from "./page";

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

vi.mock("@/modules/auth/components/back-to-login-button", () => ({
  BackToLoginButton: () => <button>Back to Login</button>,
}));

vi.mock("@/modules/auth/components/form-wrapper", () => ({
  FormWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("ResetPasswordSuccessPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders success page with correct translations", async () => {
    render(await ResetPasswordSuccessPage());

    expect(screen.getByText("auth.forgot-password.reset.success.heading")).toBeInTheDocument();
    expect(screen.getByText("auth.forgot-password.reset.success.text")).toBeInTheDocument();
    expect(screen.getByText("Back to Login")).toBeInTheDocument();
  });
});
