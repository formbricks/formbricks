import { getTranslate } from "@/tolgee/server";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TFnType } from "@tolgee/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BackToLoginButton } from "./back-to-login-button";

vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

describe("BackToLoginButton", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders login button with correct link and translation", async () => {
    const mockTranslate = vi.mocked(getTranslate);
    const mockT: TFnType = (key) => {
      if (key === "auth.signup.log_in") return "Back to Login";
      return key;
    };
    mockTranslate.mockResolvedValue(mockT);

    render(await BackToLoginButton());

    const link = screen.getByRole("link", { name: "Back to Login" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/auth/login");
  });
});
