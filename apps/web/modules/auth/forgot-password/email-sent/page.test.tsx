import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { EmailSentPage } from "./page";

vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

vi.mock("@/modules/auth/components/back-to-login-button", () => ({
  BackToLoginButton: () => <div>Back to Login</div>,
}));

describe("EmailSentPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the email sent page with correct translations", async () => {
    render(await EmailSentPage());

    expect(screen.getByText("auth.forgot-password.email-sent.heading")).toBeInTheDocument();
    expect(screen.getByText("auth.forgot-password.email-sent.text")).toBeInTheDocument();
    expect(screen.getByText("Back to Login")).toBeInTheDocument();
  });
});
