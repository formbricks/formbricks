import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Modal } from "../modal";
import { ModalWithTabs } from "./index";

// Mock Modal component
vi.mock("../modal", () => ({
  Modal: vi.fn(({ children, open, setOpen, closeOnOutsideClick, size, restrictOverflow, noPadding }) =>
    open ? (
      <div
        data-testid="modal-component"
        data-no-padding={noPadding ? "true" : "false"}
        data-size={size}
        data-restrict-overflow={restrictOverflow ? "true" : "false"}
        data-close-outside={closeOnOutsideClick ? "true" : "false"}>
        {children}
        <button data-testid="close-modal" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    ) : null
  ),
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

  test("renders modal with tabs when open", () => {
    render(<ModalWithTabs {...defaultProps} />);

    expect(screen.getByTestId("modal-component")).toBeInTheDocument();
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

    expect(screen.queryByTestId("modal-component")).not.toBeInTheDocument();
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

    // Close the modal
    await user.click(screen.getByTestId("close-modal"));
    expect(setOpen).toHaveBeenCalledWith(false);

    // Reopen the modal
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

  test("passes proper props to Modal component", () => {
    render(
      <ModalWithTabs
        open={true}
        setOpen={vi.fn()}
        tabs={mockTabs}
        closeOnOutsideClick={true}
        size="md"
        restrictOverflow={true}
      />
    );

    const modalElement = screen.getByTestId("modal-component");
    expect(modalElement).toHaveAttribute("data-no-padding", "true");
    expect(modalElement).toHaveAttribute("data-size", "md");
    expect(modalElement).toHaveAttribute("data-restrict-overflow", "true");
    expect(modalElement).toHaveAttribute("data-close-outside", "true");
  });

  test("uses default values for optional props", () => {
    render(<ModalWithTabs open={true} setOpen={vi.fn()} tabs={mockTabs} />);

    const modalElement = screen.getByTestId("modal-component");
    expect(modalElement).toHaveAttribute("data-size", "lg");
    expect(modalElement).toHaveAttribute("data-restrict-overflow", "false");
  });
});
