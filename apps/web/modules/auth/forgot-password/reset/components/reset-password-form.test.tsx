import { resetPasswordAction } from "@/modules/auth/forgot-password/reset/actions";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ResetPasswordForm } from "./reset-password-form";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("@/modules/auth/forgot-password/reset/actions", () => ({
  resetPasswordAction: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

describe("ResetPasswordForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockRouter = {
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  };

  const mockSearchParams = {
    get: vi.fn(),
    append: vi.fn(),
    delete: vi.fn(),
    set: vi.fn(),
    sort: vi.fn(),
    toString: vi.fn(),
    forEach: vi.fn(),
    entries: vi.fn(),
    keys: vi.fn(),
    values: vi.fn(),
    has: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue(mockRouter as any);
    vi.mocked(useSearchParams).mockReturnValue(mockSearchParams as any);
    vi.mocked(mockSearchParams.get).mockReturnValue("test-token");
  });

  test("renders the form with password fields", () => {
    render(<ResetPasswordForm />);

    expect(screen.getByLabelText("auth.forgot-password.reset.new_password")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.forgot-password.reset.confirm_password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "auth.forgot-password.reset_password" })).toBeInTheDocument();
  });

  test("shows error when passwords do not match", async () => {
    render(<ResetPasswordForm />);

    const passwordInput = screen.getByLabelText("auth.forgot-password.reset.new_password");
    const confirmPasswordInput = screen.getByLabelText("auth.forgot-password.reset.confirm_password");

    await userEvent.type(passwordInput, "Password123!");
    await userEvent.type(confirmPasswordInput, "Different123!");

    const submitButton = screen.getByRole("button", { name: "auth.forgot-password.reset_password" });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("auth.forgot-password.reset.passwords_do_not_match");
    });
  });

  test("successfully resets password and redirects", async () => {
    vi.mocked(resetPasswordAction).mockResolvedValueOnce({ data: { success: true } });

    render(<ResetPasswordForm />);

    const passwordInput = screen.getByLabelText("auth.forgot-password.reset.new_password");
    const confirmPasswordInput = screen.getByLabelText("auth.forgot-password.reset.confirm_password");

    await userEvent.type(passwordInput, "Password123!");
    await userEvent.type(confirmPasswordInput, "Password123!");

    const submitButton = screen.getByRole("button", { name: "auth.forgot-password.reset_password" });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(resetPasswordAction).toHaveBeenCalledWith({
        token: "test-token",
        password: "Password123!",
      });
      expect(mockRouter.push).toHaveBeenCalledWith("/auth/forgot-password/reset/success");
    });
  });

  test("shows error when no token is provided", async () => {
    vi.mocked(mockSearchParams.get).mockReturnValueOnce(null);

    render(<ResetPasswordForm />);

    const passwordInput = screen.getByLabelText("auth.forgot-password.reset.new_password");
    const confirmPasswordInput = screen.getByLabelText("auth.forgot-password.reset.confirm_password");

    await userEvent.type(passwordInput, "Password123!");
    await userEvent.type(confirmPasswordInput, "Password123!");

    const submitButton = screen.getByRole("button", { name: "auth.forgot-password.reset_password" });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("auth.forgot-password.reset.no_token_provided");
    });
  });
});
