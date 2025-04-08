import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { signIn } from "next-auth/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";
import { GoogleButton } from "./google-button";

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

describe("GoogleButton", () => {
  const defaultProps = {
    source: "signin" as const,
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders correctly with default props", () => {
    render(<GoogleButton {...defaultProps} />);
    const button = screen.getByRole("button", { name: "auth.continue_with_google" });
    expect(button).toBeInTheDocument();
  });

  it("renders with last used indicator when lastUsed is true", () => {
    render(<GoogleButton {...defaultProps} lastUsed={true} />);
    expect(screen.getByText("auth.last_used")).toBeInTheDocument();
  });

  it("sets localStorage item and calls signIn on click", async () => {
    render(<GoogleButton {...defaultProps} />);
    const button = screen.getByRole("button", { name: "auth.continue_with_google" });
    fireEvent.click(button);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(FORMBRICKS_LOGGED_IN_WITH_LS, "Google");
    expect(signIn).toHaveBeenCalledWith("google", {
      redirect: true,
      callbackUrl: "/?source=signin",
    });
  });

  it("uses inviteUrl in callbackUrl when provided", async () => {
    const inviteUrl = "https://example.com/invite";
    render(<GoogleButton {...defaultProps} inviteUrl={inviteUrl} />);
    const button = screen.getByRole("button", { name: "auth.continue_with_google" });
    fireEvent.click(button);

    expect(signIn).toHaveBeenCalledWith("google", {
      redirect: true,
      callbackUrl: "https://example.com/invite?source=signin",
    });
  });

  it("handles signup source correctly", async () => {
    render(<GoogleButton {...defaultProps} source="signup" />);
    const button = screen.getByRole("button", { name: "auth.continue_with_google" });
    fireEvent.click(button);

    expect(signIn).toHaveBeenCalledWith("google", {
      redirect: true,
      callbackUrl: "/?source=signup",
    });
  });
});
