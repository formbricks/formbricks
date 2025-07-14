import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ModalWithTabs } from "./index";

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
  DialogContent: vi.fn(({ children, disableCloseOnOutsideClick }) => (
    <div
      data-testid="dialog-content"
      data-disable-close-outside={disableCloseOnOutsideClick ? "true" : "false"}>
      {children}
    </div>
  )),
  DialogHeader: vi.fn(({ children }) => <div data-testid="dialog-header">{children}</div>),
  DialogTitle: vi.fn(({ children }) => <h2 data-testid="dialog-title">{children}</h2>),
  DialogDescription: vi.fn(({ children }) => <p data-testid="dialog-description">{children}</p>),
  DialogBody: vi.fn(({ children }) => <div data-testid="dialog-body">{children}</div>),
}));

describe("ModalWithTabs", () => {
  afterEach(() => {
    cleanup();
  });

  const mockTabs = [
    {
      title: "Tab 1",
      children: <div data-testid="tab-1-content">Content for Tab 1</div>,
    },
    {
      title: "Tab 2",
      children: <div data-testid="tab-2-content">Content for Tab 2</div>,
    },
    {
      title: "Tab 3",
      children: <div data-testid="tab-3-content">Content for Tab 3</div>,
    },
  ];

  const defaultProps = {
    open: true,
    setOpen: vi.fn(),
    tabs: mockTabs,
    label: "Test Label",
    description: "Test Description",
  };

  test("renders dialog with tabs when open", () => {
    render(<ModalWithTabs {...defaultProps} />);

    expect(screen.getByTestId("dialog-component")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-header")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-description")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-body")).toBeInTheDocument();
    expect(screen.getByText("Test Label")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();

    // Check all tab titles are displayed
    expect(screen.getByText("Tab 1")).toBeInTheDocument();
    expect(screen.getByText("Tab 2")).toBeInTheDocument();
    expect(screen.getByText("Tab 3")).toBeInTheDocument();

    // First tab should be displayed by default
    expect(screen.getByTestId("tab-1-content")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-2-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tab-3-content")).not.toBeInTheDocument();
  });

  test("doesn't render when not open", () => {
    render(<ModalWithTabs {...defaultProps} open={false} />);

    expect(screen.queryByTestId("dialog-component")).not.toBeInTheDocument();
  });

  test("switches tabs when clicking on tab buttons", async () => {
    const user = userEvent.setup();
    render(<ModalWithTabs {...defaultProps} />);

    // First tab should be active by default
    expect(screen.getByTestId("tab-1-content")).toBeInTheDocument();

    // Click on second tab
    await user.click(screen.getByText("Tab 2"));

    // Second tab content should be displayed
    expect(screen.queryByTestId("tab-1-content")).not.toBeInTheDocument();
    expect(screen.getByTestId("tab-2-content")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-3-content")).not.toBeInTheDocument();

    // Click on third tab
    await user.click(screen.getByText("Tab 3"));

    // Third tab content should be displayed
    expect(screen.queryByTestId("tab-1-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tab-2-content")).not.toBeInTheDocument();
    expect(screen.getByTestId("tab-3-content")).toBeInTheDocument();
  });

  test("resets to first tab when reopened", async () => {
    const setOpen = vi.fn();
    const { rerender } = render(<ModalWithTabs {...defaultProps} setOpen={setOpen} />);

    const user = userEvent.setup();

    // Switch to second tab
    await user.click(screen.getByText("Tab 2"));
    expect(screen.getByTestId("tab-2-content")).toBeInTheDocument();

    // Close the dialog
    await user.click(screen.getByTestId("close-dialog"));
    expect(setOpen).toHaveBeenCalledWith(false);

    // Reopen the dialog
    rerender(<ModalWithTabs {...defaultProps} setOpen={setOpen} open={false} />);
    rerender(<ModalWithTabs {...defaultProps} setOpen={setOpen} open={true} />);

    // First tab should be active again
    expect(screen.getByTestId("tab-1-content")).toBeInTheDocument();
    expect(screen.queryByTestId("tab-2-content")).not.toBeInTheDocument();
  });

  test("renders with icon when provided", () => {
    const mockIcon = <div data-testid="test-icon">Icon</div>;
    render(<ModalWithTabs {...defaultProps} icon={mockIcon} />);

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  test("passes proper props to Dialog components", () => {
    render(<ModalWithTabs open={true} setOpen={vi.fn()} tabs={mockTabs} closeOnOutsideClick={true} />);

    const dialogContentElement = screen.getByTestId("dialog-content");
    expect(dialogContentElement).toHaveAttribute("data-disable-close-outside", "true");
  });

  test("uses default values for optional props", () => {
    render(<ModalWithTabs open={true} setOpen={vi.fn()} tabs={mockTabs} />);

    const dialogElement = screen.getByTestId("dialog-component");
    expect(dialogElement).toBeInTheDocument();
  });

  test("renders without label and description when not provided", () => {
    render(<ModalWithTabs open={true} setOpen={vi.fn()} tabs={mockTabs} />);

    expect(screen.getByTestId("dialog-title")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-description")).toBeInTheDocument();
    // The title and description elements exist but should be empty
    expect(screen.getByTestId("dialog-title")).toBeEmptyDOMElement();
    expect(screen.getByTestId("dialog-description")).toBeEmptyDOMElement();
  });

  test("applies correct styling to active and inactive tabs", () => {
    render(<ModalWithTabs {...defaultProps} />);

    const tab1Button = screen.getByText("Tab 1").closest("button");
    const tab2Button = screen.getByText("Tab 2").closest("button");

    // First tab should have active styling
    expect(tab1Button).toHaveClass("border-brand-dark", "border-b-2", "font-semibold", "text-slate-900");

    // Second tab should have inactive styling
    expect(tab2Button).toHaveClass("text-slate-500");
    expect(tab2Button).not.toHaveClass("border-brand-dark", "border-b-2", "font-semibold", "text-slate-900");
  });
});
