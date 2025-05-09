import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ConfirmationModal } from "./index";

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/modules/ui/components/modal", () => ({
  Modal: ({ open, children, title, hideCloseButton, closeOnOutsideClick, setOpen }: any) => (
    <div
      data-testid="mock-modal"
      data-open={open}
      data-title={title}
      data-hide-close-button={hideCloseButton}
      data-close-on-outside-click={closeOnOutsideClick}>
      <button data-testid="modal-close-button" onClick={() => setOpen(false)}>
        Close
      </button>
      <div data-testid="modal-title">{title}</div>
      <div data-testid="modal-content">{children}</div>
    </div>
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, variant, disabled, loading }: any) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-disabled={disabled}
      data-loading={loading}
      data-testid="mock-button">
      {children}
    </button>
  ),
}));

describe("ConfirmationModal", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with the correct props", () => {
    const mockSetOpen = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ConfirmationModal
        title="Test Title"
        open={true}
        setOpen={mockSetOpen}
        onConfirm={mockOnConfirm}
        text="Test confirmation text"
        buttonText="Confirm Action"
      />
    );

    expect(screen.getByTestId("mock-modal")).toBeInTheDocument();
    expect(screen.getByTestId("mock-modal")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("mock-modal")).toHaveAttribute("data-title", "Test Title");
    expect(screen.getByTestId("modal-content")).toContainHTML("Test confirmation text");

    // Check that buttons exist
    const buttons = screen.getAllByTestId("mock-button");
    expect(buttons).toHaveLength(2);

    // Check cancel button
    expect(buttons[0]).toHaveTextContent("common.cancel");

    // Check confirm button
    expect(buttons[1]).toHaveTextContent("Confirm Action");
    expect(buttons[1]).toHaveAttribute("data-variant", "destructive");
  });

  test("handles cancel button click correctly", async () => {
    const user = userEvent.setup();
    const mockSetOpen = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ConfirmationModal
        title="Test Title"
        open={true}
        setOpen={mockSetOpen}
        onConfirm={mockOnConfirm}
        text="Test confirmation text"
        buttonText="Confirm Action"
      />
    );

    const buttons = screen.getAllByTestId("mock-button");
    await user.click(buttons[0]); // Click cancel button

    expect(mockSetOpen).toHaveBeenCalledWith(false);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  test("handles close modal button click correctly", async () => {
    const user = userEvent.setup();
    const mockSetOpen = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ConfirmationModal
        title="Test Title"
        open={true}
        setOpen={mockSetOpen}
        onConfirm={mockOnConfirm}
        text="Test confirmation text"
        buttonText="Confirm Action"
      />
    );

    await user.click(screen.getByTestId("modal-close-button"));

    expect(mockSetOpen).toHaveBeenCalledWith(false);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  test("handles confirm button click correctly", async () => {
    const user = userEvent.setup();
    const mockSetOpen = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ConfirmationModal
        title="Test Title"
        open={true}
        setOpen={mockSetOpen}
        onConfirm={mockOnConfirm}
        text="Test confirmation text"
        buttonText="Confirm Action"
      />
    );

    const buttons = screen.getAllByTestId("mock-button");
    await user.click(buttons[1]); // Click confirm button

    expect(mockOnConfirm).toHaveBeenCalled();
    expect(mockSetOpen).not.toHaveBeenCalled(); // Modal closing should be handled by onConfirm
  });

  test("disables confirm button when isButtonDisabled is true", () => {
    const mockSetOpen = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ConfirmationModal
        title="Test Title"
        open={true}
        setOpen={mockSetOpen}
        onConfirm={mockOnConfirm}
        text="Test confirmation text"
        buttonText="Confirm Action"
        isButtonDisabled={true}
      />
    );

    const buttons = screen.getAllByTestId("mock-button");
    expect(buttons[1]).toHaveAttribute("data-disabled", "true");
  });

  test("does not trigger onConfirm when button is disabled", async () => {
    const user = userEvent.setup();
    const mockSetOpen = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ConfirmationModal
        title="Test Title"
        open={true}
        setOpen={mockSetOpen}
        onConfirm={mockOnConfirm}
        text="Test confirmation text"
        buttonText="Confirm Action"
        isButtonDisabled={true}
      />
    );

    const buttons = screen.getAllByTestId("mock-button");
    await user.click(buttons[1]); // Click confirm button

    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  test("shows loading state on confirm button", () => {
    const mockSetOpen = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ConfirmationModal
        title="Test Title"
        open={true}
        setOpen={mockSetOpen}
        onConfirm={mockOnConfirm}
        text="Test confirmation text"
        buttonText="Confirm Action"
        buttonLoading={true}
      />
    );

    const buttons = screen.getAllByTestId("mock-button");
    expect(buttons[1]).toHaveAttribute("data-loading", "true");
  });

  test("passes correct modal props", () => {
    const mockSetOpen = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ConfirmationModal
        title="Test Title"
        open={true}
        setOpen={mockSetOpen}
        onConfirm={mockOnConfirm}
        text="Test confirmation text"
        buttonText="Confirm Action"
        hideCloseButton={true}
        closeOnOutsideClick={false}
      />
    );

    expect(screen.getByTestId("mock-modal")).toHaveAttribute("data-hide-close-button", "true");
    expect(screen.getByTestId("mock-modal")).toHaveAttribute("data-close-on-outside-click", "false");
  });

  test("renders with default button variant", () => {
    const mockSetOpen = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ConfirmationModal
        title="Test Title"
        open={true}
        setOpen={mockSetOpen}
        onConfirm={mockOnConfirm}
        text="Test confirmation text"
        buttonText="Confirm Action"
        buttonVariant="default"
      />
    );

    const buttons = screen.getAllByTestId("mock-button");
    expect(buttons[1]).toHaveAttribute("data-variant", "default");
  });
});
