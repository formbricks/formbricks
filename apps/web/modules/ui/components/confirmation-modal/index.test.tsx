import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ConfirmationModal } from "./index";

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock Dialog components
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: vi.fn(({ children, open, onOpenChange }) =>
    open ? (
      <div data-testid="dialog-component" data-open={open ? "true" : "false"}>
        {children}
        <button data-testid="close-dialog" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null
  ),
  DialogContent: vi.fn(({ children, hideCloseButton, disableCloseOnOutsideClick }) => (
    <div
      data-testid="dialog-content"
      data-hide-close-button={hideCloseButton ? "true" : "false"}
      data-disable-close-outside={disableCloseOnOutsideClick ? "true" : "false"}>
      {children}
    </div>
  )),
  DialogHeader: vi.fn(({ children }) => <div data-testid="dialog-header">{children}</div>),
  DialogTitle: vi.fn(({ children }) => <h2 data-testid="dialog-title">{children}</h2>),
  DialogDescription: vi.fn(({ children }) => <div data-testid="dialog-description">{children}</div>),
  DialogFooter: vi.fn(({ children }) => <div data-testid="dialog-footer">{children}</div>),
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

    expect(screen.getByTestId("dialog-component")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-component")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Test Title");
    expect(screen.getByTestId("dialog-description")).toContainHTML("Test confirmation text");

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

  test("handles close dialog button click correctly", async () => {
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

    await user.click(screen.getByTestId("close-dialog"));

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

  test("passes correct dialog props", () => {
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

    expect(screen.getByTestId("dialog-content")).toHaveAttribute("data-hide-close-button", "true");
    expect(screen.getByTestId("dialog-content")).toHaveAttribute("data-disable-close-outside", "true");
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

  test("does not render when open is false", () => {
    const mockSetOpen = vi.fn();
    const mockOnConfirm = vi.fn();

    render(
      <ConfirmationModal
        title="Test Title"
        open={false}
        setOpen={mockSetOpen}
        onConfirm={mockOnConfirm}
        text="Test confirmation text"
        buttonText="Confirm Action"
      />
    );

    expect(screen.queryByTestId("dialog-component")).not.toBeInTheDocument();
  });
});
