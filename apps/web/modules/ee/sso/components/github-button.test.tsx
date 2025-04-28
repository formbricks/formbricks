import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { signIn } from "next-auth/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GithubButton } from "./github-button";

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

// Mock localStorage
const mockLocalStorage = {
  setItem: vi.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

describe("GithubButton", () => {
  const defaultProps = {
    source: "signin" as const,
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly with default props", () => {
    render(<GithubButton {...defaultProps} />);
    const button = screen.getByRole("button", { name: "auth.continue_with_github" });
    expect(button).toBeInTheDocument();
  });

  test("renders with last used indicator when lastUsed is true", () => {
    render(<GithubButton {...defaultProps} lastUsed={true} />);
    expect(screen.getByText("auth.last_used")).toBeInTheDocument();
  });

  test("sets localStorage item and calls signIn on click", async () => {
    render(<GithubButton {...defaultProps} />);
    const button = screen.getByRole("button", { name: "auth.continue_with_github" });
    fireEvent.click(button);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(FORMBRICKS_LOGGED_IN_WITH_LS, "Github");
    expect(signIn).toHaveBeenCalledWith("github", {
      redirect: true,
      callbackUrl: "/?source=signin",
    });
  });

  test("uses inviteUrl in callbackUrl when provided", async () => {
    const inviteUrl = "https://example.com/invite";
    render(<GithubButton {...defaultProps} inviteUrl={inviteUrl} />);
    const button = screen.getByRole("button", { name: "auth.continue_with_github" });
    fireEvent.click(button);

    expect(signIn).toHaveBeenCalledWith("github", {
      redirect: true,
      callbackUrl: "https://example.com/invite?source=signin",
    });
  });

  test("handles signup source correctly", async () => {
    render(<GithubButton {...defaultProps} source="signup" />);
    const button = screen.getByRole("button", { name: "auth.continue_with_github" });
    fireEvent.click(button);

    expect(signIn).toHaveBeenCalledWith("github", {
      redirect: true,
      callbackUrl: "/?source=signup",
    });
  });
});
