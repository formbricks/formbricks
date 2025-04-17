import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { signIn } from "next-auth/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@formbricks/lib/localStorage";
import { AzureButton } from "./azure-button";

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

describe("AzureButton", () => {
  const defaultProps = {
    source: "signin" as const,
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly with default props", () => {
    render(<AzureButton {...defaultProps} />);
    const button = screen.getByRole("button", { name: "auth.continue_with_azure" });
    expect(button).toBeInTheDocument();
  });

  test("renders with last used indicator when lastUsed is true", () => {
    render(<AzureButton {...defaultProps} lastUsed={true} />);
    expect(screen.getByText("auth.last_used")).toBeInTheDocument();
  });

  test("sets localStorage item and calls signIn on click", async () => {
    render(<AzureButton {...defaultProps} />);
    const button = screen.getByRole("button", { name: "auth.continue_with_azure" });
    fireEvent.click(button);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(FORMBRICKS_LOGGED_IN_WITH_LS, "Azure");
    expect(signIn).toHaveBeenCalledWith("azure-ad", {
      redirect: true,
      callbackUrl: "/?source=signin",
    });
  });

  test("uses inviteUrl in callbackUrl when provided", async () => {
    const inviteUrl = "https://example.com/invite";
    render(<AzureButton {...defaultProps} inviteUrl={inviteUrl} />);
    const button = screen.getByRole("button", { name: "auth.continue_with_azure" });
    fireEvent.click(button);

    expect(signIn).toHaveBeenCalledWith("azure-ad", {
      redirect: true,
      callbackUrl: "https://example.com/invite?source=signin",
    });
  });

  test("handles signup source correctly", async () => {
    render(<AzureButton {...defaultProps} source="signup" />);
    const button = screen.getByRole("button", { name: "auth.continue_with_azure" });
    fireEvent.click(button);

    expect(signIn).toHaveBeenCalledWith("azure-ad", {
      redirect: true,
      callbackUrl: "/?source=signup",
    });
  });

  test("triggers direct redirect when directRedirect is true", () => {
    render(<AzureButton {...defaultProps} directRedirect={true} />);
    expect(signIn).toHaveBeenCalledWith("azure-ad", {
      redirect: true,
      callbackUrl: "/?source=signin",
    });
  });
});
