import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CustomDialog } from "./index";

// Mock dependencies
vi.mock("@/modules/ui/components/modal", () => ({
  Modal: ({ children, open, title }) =>
    open ? (
      <div data-testid="mock-modal" data-title={title}>
        {children}
      </div>
    ) : null,
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, variant, loading, disabled }) => (
    <button
      data-testid={`mock-button-${variant}`}
      onClick={onClick}
      disabled={loading || disabled}
      data-loading={loading ? "true" : "false"}>
      {children}
    </button>
  ),
}));

describe("CustomDialog", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders when open is true", () => {
    render(<CustomDialog open={true} setOpen={() => {}} onOk={() => {}} title="Test Dialog" />);

    expect(screen.getByTestId("mock-modal")).toBeInTheDocument();
  });

  test("does not render when open is false", () => {
    render(<CustomDialog open={false} setOpen={() => {}} onOk={() => {}} />);

    expect(screen.queryByTestId("mock-modal")).not.toBeInTheDocument();
  });

  test("renders with title", () => {
    render(<CustomDialog open={true} setOpen={() => {}} onOk={() => {}} title="Test Dialog Title" />);

    expect(screen.getByTestId("mock-modal")).toHaveAttribute("data-title", "Test Dialog Title");
  });

  test("renders text content", () => {
    render(<CustomDialog open={true} setOpen={() => {}} onOk={() => {}} text="Dialog description text" />);

    expect(screen.getByText("Dialog description text")).toBeInTheDocument();
  });

  test("renders children content", () => {
    render(
      <CustomDialog open={true} setOpen={() => {}} onOk={() => {}}>
        <div data-testid="custom-content">Custom content</div>
      </CustomDialog>
    );

    expect(screen.getByTestId("custom-content")).toBeInTheDocument();
  });

  test("calls onOk when ok button is clicked", async () => {
    const user = userEvent.setup();
    const handleOk = vi.fn();

    render(<CustomDialog open={true} setOpen={() => {}} onOk={handleOk} />);

    await user.click(screen.getByTestId("mock-button-destructive"));
    expect(handleOk).toHaveBeenCalledTimes(1);
  });

  test("calls setOpen and onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const handleCancel = vi.fn();
    const setOpen = vi.fn();

    render(<CustomDialog open={true} setOpen={setOpen} onOk={() => {}} onCancel={handleCancel} />);

    await user.click(screen.getByTestId("mock-button-secondary"));
    expect(handleCancel).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("calls only setOpen when cancel button is clicked if onCancel is not provided", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();

    render(<CustomDialog open={true} setOpen={setOpen} onOk={() => {}} />);

    await user.click(screen.getByTestId("mock-button-secondary"));
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("renders with custom button texts", () => {
    render(
      <CustomDialog
        open={true}
        setOpen={() => {}}
        onOk={() => {}}
        okBtnText="Custom OK"
        cancelBtnText="Custom Cancel"
      />
    );

    expect(screen.getByText("Custom OK")).toBeInTheDocument();
    expect(screen.getByText("Custom Cancel")).toBeInTheDocument();
  });

  test("renders with default button texts when not provided", () => {
    render(<CustomDialog open={true} setOpen={() => {}} onOk={() => {}} />);

    // Since tolgee is mocked, the translation key itself is returned
    expect(screen.getByText("common.yes")).toBeInTheDocument();
    expect(screen.getByText("common.cancel")).toBeInTheDocument();
  });

  test("renders loading state on ok button", () => {
    render(<CustomDialog open={true} setOpen={() => {}} onOk={() => {}} isLoading={true} />);

    expect(screen.getByTestId("mock-button-destructive")).toHaveAttribute("data-loading", "true");
  });

  test("renders disabled ok button", () => {
    render(<CustomDialog open={true} setOpen={() => {}} onOk={() => {}} disabled={true} />);

    expect(screen.getByTestId("mock-button-destructive")).toBeDisabled();
  });
});
