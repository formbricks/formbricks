import * as DialogPrimitive from "@radix-ui/react-dialog";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Modal } from ".";

// Mock the Dialog components from radix-ui
vi.mock("@radix-ui/react-dialog", async () => {
  const actual = await vi.importActual<typeof import("@radix-ui/react-dialog")>("@radix-ui/react-dialog");
  return {
    ...actual,
    Root: ({ children, open, onOpenChange }: any) => (
      <div data-testid="dialog-root" data-state={open ? "open" : "closed"}>
        {open && children}
        <button data-testid="mock-close-trigger" onClick={() => onOpenChange(false)}>
          Close Dialog
        </button>
      </div>
    ),
    Portal: ({ children }: any) => <div data-testid="dialog-portal">{children}</div>,
    Overlay: ({ className, ...props }: any) => (
      <div data-testid="dialog-overlay" className={className} {...props} />
    ),
    Content: ({ className, children, ...props }: any) => (
      <div data-testid="dialog-content" className={className} {...props}>
        {children}
      </div>
    ),
    Close: ({ className, children }: any) => (
      <button data-testid="dialog-close" className={className}>
        {children}
      </button>
    ),
    DialogTitle: ({ children }: any) => <div data-testid="dialog-title">{children}</div>,
    DialogDescription: () => <div data-testid="dialog-description" />,
  };
});

describe("Modal", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders nothing when open is false", () => {
    render(
      <Modal open={false} setOpen={() => {}}>
        <div>Test Content</div>
      </Modal>
    );

    expect(screen.queryByTestId("dialog-root")).not.toBeInTheDocument();
  });

  test("renders modal content when open is true", () => {
    render(
      <Modal open={true} setOpen={() => {}}>
        <div data-testid="modal-content">Test Content</div>
      </Modal>
    );

    expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-portal")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    expect(screen.getByTestId("modal-content")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  test("renders with title when provided", () => {
    render(
      <Modal open={true} setOpen={() => {}} title="Test Title">
        <div>Test Content</div>
      </Modal>
    );

    expect(screen.getByTestId("dialog-title")).toBeInTheDocument();
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  test("applies size classes correctly", () => {
    const { rerender } = render(
      <Modal open={true} setOpen={() => {}} size="lg">
        <div>Test Content</div>
      </Modal>
    );

    let content = screen.getByTestId("dialog-content");
    expect(content.className).toContain("sm:max-w-[820px]");

    rerender(
      <Modal open={true} setOpen={() => {}} size="xl">
        <div>Test Content</div>
      </Modal>
    );

    content = screen.getByTestId("dialog-content");
    expect(content.className).toContain("sm:max-w-[960px]");
    expect(content.className).toContain("sm:max-h-[640px]");

    rerender(
      <Modal open={true} setOpen={() => {}} size="xxl">
        <div>Test Content</div>
      </Modal>
    );

    content = screen.getByTestId("dialog-content");
    expect(content.className).toContain("sm:max-w-[1240px]");
    expect(content.className).toContain("sm:max-h-[760px]");
  });

  test("applies noPadding class when noPadding is true", () => {
    render(
      <Modal open={true} setOpen={() => {}} noPadding>
        <div>Test Content</div>
      </Modal>
    );

    const content = screen.getByTestId("dialog-content");
    expect(content.className).not.toContain("px-4 pt-5 pb-4 sm:p-6");
  });

  test("applies the blur class to overlay when blur is true", () => {
    render(
      <Modal open={true} setOpen={() => {}} blur={true}>
        <div>Test Content</div>
      </Modal>
    );

    const overlay = screen.getByTestId("dialog-overlay");
    expect(overlay.className).toContain("backdrop-blur-md");
  });

  test("does not apply the blur class to overlay when blur is false", () => {
    render(
      <Modal open={true} setOpen={() => {}} blur={false}>
        <div>Test Content</div>
      </Modal>
    );

    const overlay = screen.getByTestId("dialog-overlay");
    expect(overlay.className).not.toContain("backdrop-blur-md");
  });

  test("hides close button when hideCloseButton is true", () => {
    render(
      <Modal open={true} setOpen={() => {}} hideCloseButton={true}>
        <div>Test Content</div>
      </Modal>
    );

    const closeButton = screen.getByTestId("dialog-close");
    expect(closeButton.className).toContain("!hidden");
  });

  test("calls setOpen when dialog is closed", async () => {
    const setOpen = vi.fn();
    const user = userEvent.setup();

    render(
      <Modal open={true} setOpen={setOpen}>
        <div>Test Content</div>
      </Modal>
    );

    await user.click(screen.getByTestId("mock-close-trigger"));
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("applies restrictOverflow class when restrictOverflow is true", () => {
    render(
      <Modal open={true} setOpen={() => {}} restrictOverflow={true}>
        <div>Test Content</div>
      </Modal>
    );

    const content = screen.getByTestId("dialog-content");
    expect(content.className).not.toContain("overflow-hidden");
  });

  test("applies custom className when provided", () => {
    const customClass = "test-custom-class";

    render(
      <Modal open={true} setOpen={() => {}} className={customClass}>
        <div>Test Content</div>
      </Modal>
    );

    const content = screen.getByTestId("dialog-content");
    expect(content.className).toContain(customClass);
  });
});
