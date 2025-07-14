import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PasswordConfirmationModal } from "./password-confirmation-modal";

// Mock the Dialog component
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({ children, open, onOpenChange }: any) =>
    open ? (
      <div data-testid="dialog" role="dialog">
        {children}
        <button data-testid="dialog-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
  DialogContent: ({ children, ...props }: any) => (
    <div data-testid="dialog-content" {...props}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <p data-testid="dialog-description">{children}</p>,
  DialogBody: ({ children }: any) => <div data-testid="dialog-body">{children}</div>,
  DialogFooter: ({ children }: any) => <div data-testid="dialog-footer">{children}</div>,
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
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  test("renders dialog content when open is true", () => {
    render(<PasswordConfirmationModal {...defaultProps} />);
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toBeInTheDocument();
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
