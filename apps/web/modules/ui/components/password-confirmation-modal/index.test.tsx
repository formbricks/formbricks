import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PasswordConfirmationModal } from "./index";

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
    const passwordInput = screen.getByPlaceholderText("*******");
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("disables confirm button when form is not dirty", () => {
    render(<PasswordConfirmationModal {...defaultProps} />);
    const confirmButton = screen.getByText("common.confirm");
    expect(confirmButton).toBeDisabled();
  });

  test("enables confirm button when password is entered", async () => {
    const user = userEvent.setup();
    render(<PasswordConfirmationModal {...defaultProps} />);

    const passwordInput = screen.getByPlaceholderText("*******");
    await user.type(passwordInput, "password123");

    const confirmButton = screen.getByText("common.confirm");
    expect(confirmButton).not.toBeDisabled();
  });

  test("calls onConfirm with password when form is submitted", async () => {
    const user = userEvent.setup();
    render(<PasswordConfirmationModal {...defaultProps} />);

    const passwordInput = screen.getByPlaceholderText("*******");
    await user.type(passwordInput, "password123");

    const confirmButton = screen.getByText("common.confirm");
    await user.click(confirmButton);

    expect(defaultProps.onConfirm).toHaveBeenCalledWith("password123");
  });

  test("shows error message when password is too short", async () => {
    const user = userEvent.setup();
    render(<PasswordConfirmationModal {...defaultProps} />);

    const passwordInput = screen.getByPlaceholderText("*******");
    await user.type(passwordInput, "short");

    const confirmButton = screen.getByText("common.confirm");
    await user.click(confirmButton);

    expect(screen.getByText("String must contain at least 8 character(s)")).toBeInTheDocument();
  });

  test("handles cancel button click", async () => {
    const user = userEvent.setup();
    render(<PasswordConfirmationModal {...defaultProps} />);

    const cancelButton = screen.getByText("common.cancel");
    await user.click(cancelButton);

    expect(defaultProps.setOpen).toHaveBeenCalledWith(false);
  });

  test("handles error from onConfirm", async () => {
    const user = userEvent.setup();
    const error = new Error("Authentication failed");
    defaultProps.onConfirm.mockRejectedValueOnce(error);

    render(<PasswordConfirmationModal {...defaultProps} />);

    const passwordInput = screen.getByPlaceholderText("*******");
    await user.type(passwordInput, "password123");

    const confirmButton = screen.getByText("common.confirm");
    await user.click(confirmButton);

    expect(screen.getByText("Authentication failed")).toBeInTheDocument();
  });
});
