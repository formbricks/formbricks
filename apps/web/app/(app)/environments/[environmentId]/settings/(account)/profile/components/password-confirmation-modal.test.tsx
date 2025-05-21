import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PasswordConfirmationModal } from "./password-confirmation-modal";

// Mock the Modal component
vi.mock("@/modules/ui/components/modal", () => ({
  Modal: ({ children, open, setOpen, title }: any) =>
    open ? (
      <div data-testid="modal">
        <div data-testid="modal-title">{title}</div>
        {children}
        <button data-testid="modal-close" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    ) : null,
}));

// Mock the PasswordInput component
vi.mock("@/modules/ui/components/password-input", () => ({
  PasswordInput: ({ onChange, value, placeholder }: any) => (
    <input
      type="password"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid="password-input"
    />
  ),
}));

// Mock the useTranslate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

describe("PasswordConfirmationModal", () => {
  const defaultProps = {
    open: true,
    setOpen: vi.fn(),
    oldEmail: "old@example.com",
    newEmail: "new@example.com",
    onConfirm: vi.fn(),
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders nothing when open is false", () => {
    render(<PasswordConfirmationModal {...defaultProps} open={false} />);
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  test("renders modal content when open is true", () => {
    render(<PasswordConfirmationModal {...defaultProps} />);
    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByTestId("modal-title")).toBeInTheDocument();
  });

  test("displays old and new email addresses", () => {
    render(<PasswordConfirmationModal {...defaultProps} />);
    expect(screen.getByText("old@example.com")).toBeInTheDocument();
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
  });

  test("shows password input field", () => {
    render(<PasswordConfirmationModal {...defaultProps} />);
    const passwordInput = screen.getByTestId("password-input");
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute("placeholder", "*******");
  });

  test("disables confirm button when form is not dirty", () => {
    render(<PasswordConfirmationModal {...defaultProps} />);
    const confirmButton = screen.getByText("common.confirm");
    expect(confirmButton).toBeDisabled();
  });

  test("disables confirm button when old and new emails are the same", () => {
    render(
      <PasswordConfirmationModal {...defaultProps} oldEmail="same@example.com" newEmail="same@example.com" />
    );
    const confirmButton = screen.getByText("common.confirm");
    expect(confirmButton).toBeDisabled();
  });

  test("enables confirm button when password is entered and emails are different", async () => {
    const user = userEvent.setup();
    render(<PasswordConfirmationModal {...defaultProps} />);

    const passwordInput = screen.getByTestId("password-input");
    await user.type(passwordInput, "password123");

    const confirmButton = screen.getByText("common.confirm");
    expect(confirmButton).not.toBeDisabled();
  });

  test("shows error message when password is too short", async () => {
    const user = userEvent.setup();
    render(<PasswordConfirmationModal {...defaultProps} />);

    const passwordInput = screen.getByTestId("password-input");
    await user.type(passwordInput, "short");

    const confirmButton = screen.getByText("common.confirm");
    await user.click(confirmButton);

    expect(screen.getByText("String must contain at least 8 character(s)")).toBeInTheDocument();
  });

  test("handles cancel button click and resets form", async () => {
    const user = userEvent.setup();
    render(<PasswordConfirmationModal {...defaultProps} />);

    const passwordInput = screen.getByTestId("password-input");
    await user.type(passwordInput, "password123");

    const cancelButton = screen.getByText("common.cancel");
    await user.click(cancelButton);

    expect(defaultProps.setOpen).toHaveBeenCalledWith(false);
    await waitFor(() => {
      expect(passwordInput).toHaveValue("");
    });
  });
});
