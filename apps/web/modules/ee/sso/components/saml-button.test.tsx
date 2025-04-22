import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { doesSamlConnectionExistAction } from "@/modules/ee/sso/actions";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SamlButton } from "./saml-button";

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  signIn: vi.fn().mockResolvedValue(undefined),
}));

// Mock localStorage
const mockLocalStorage = {
  setItem: vi.fn(),
};
Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

// Mock actions
vi.mock("@/modules/ee/sso/actions", () => ({
  doesSamlConnectionExistAction: vi.fn(),
}));

// Mock toast
vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
  },
}));

describe("SamlButton", () => {
  const defaultProps = {
    source: "signin" as const,
    samlTenant: "test-tenant",
    samlProduct: "test-product",
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly with default props", () => {
    render(<SamlButton {...defaultProps} />);
    const button = screen.getByRole("button", { name: "auth.continue_with_saml" });
    expect(button).toBeInTheDocument();
  });

  test("renders with last used indicator when lastUsed is true", () => {
    render(<SamlButton {...defaultProps} lastUsed={true} />);
    expect(screen.getByText("auth.last_used")).toBeInTheDocument();
  });

  test("sets localStorage item and calls signIn on click when SAML connection exists", async () => {
    vi.mocked(doesSamlConnectionExistAction).mockResolvedValue({ data: true });
    render(<SamlButton {...defaultProps} />);
    const button = screen.getByRole("button", { name: "auth.continue_with_saml" });

    await fireEvent.click(button);

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(FORMBRICKS_LOGGED_IN_WITH_LS, "Saml");
    expect(signIn).toHaveBeenCalledWith(
      "saml",
      {
        redirect: true,
        callbackUrl: "/?source=signin",
      },
      {
        tenant: "test-tenant",
        product: "test-product",
      }
    );
  });

  test("shows error toast when SAML connection does not exist", async () => {
    vi.mocked(doesSamlConnectionExistAction).mockResolvedValue({ data: false });
    render(<SamlButton {...defaultProps} />);
    const button = screen.getByRole("button", { name: "auth.continue_with_saml" });

    await fireEvent.click(button);

    expect(toast.error).toHaveBeenCalledWith("auth.saml_connection_error");
    expect(signIn).not.toHaveBeenCalled();
  });

  test("uses inviteUrl in callbackUrl when provided", async () => {
    vi.mocked(doesSamlConnectionExistAction).mockResolvedValue({ data: true });
    const inviteUrl = "https://example.com/invite";
    render(<SamlButton {...defaultProps} inviteUrl={inviteUrl} />);
    const button = screen.getByRole("button", { name: "auth.continue_with_saml" });

    await fireEvent.click(button);

    expect(signIn).toHaveBeenCalledWith(
      "saml",
      {
        redirect: true,
        callbackUrl: "https://example.com/invite?source=signin",
      },
      {
        tenant: "test-tenant",
        product: "test-product",
      }
    );
  });

  test("handles signup source correctly", async () => {
    vi.mocked(doesSamlConnectionExistAction).mockResolvedValue({ data: true });
    render(<SamlButton {...defaultProps} source="signup" />);
    const button = screen.getByRole("button", { name: "auth.continue_with_saml" });

    await fireEvent.click(button);

    expect(signIn).toHaveBeenCalledWith(
      "saml",
      {
        redirect: true,
        callbackUrl: "/?source=signup",
      },
      {
        tenant: "test-tenant",
        product: "test-product",
      }
    );
  });
});
