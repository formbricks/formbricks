import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BackToLoginButton } from "./back-to-login-button";

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: vi.fn(() => (key: string) => key),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

describe("BackToLoginButton", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders login button with correct link and translation", async () => {
    render(await BackToLoginButton());

    const link = screen.getByRole("link", { name: "auth.signup.log_in" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/auth/login");
  });
});
