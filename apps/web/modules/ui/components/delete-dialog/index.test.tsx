import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DeleteDialog } from "./index";

vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-title">{children}</div>
  ),
  DialogBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-body">{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, loading, variant, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      data-testid={`button-${variant}`}
      data-loading={loading}>
      {children}
    </button>
  ),
}));

describe("DeleteDialog", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correctly when open", () => {
    const setOpen = vi.fn();
    const onDelete = vi.fn();

    render(<DeleteDialog open={true} setOpen={setOpen} deleteWhat="Item" onDelete={onDelete} />);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-header")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("common.delete Item");
    expect(screen.getByTestId("dialog-body")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-footer")).toBeInTheDocument();
    expect(screen.getByText("common.are_you_sure_this_action_cannot_be_undone")).toBeInTheDocument();
    expect(screen.getByTestId("button-secondary")).toHaveTextContent("common.cancel");
    expect(screen.getByTestId("button-destructive")).toHaveTextContent("common.delete");
  });

  test("doesn't render when closed", () => {
    const setOpen = vi.fn();
    const onDelete = vi.fn();

    render(<DeleteDialog open={false} setOpen={setOpen} deleteWhat="Item" onDelete={onDelete} />);

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  test("calls onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    const onDelete = vi.fn();

    render(<DeleteDialog open={true} setOpen={setOpen} deleteWhat="Item" onDelete={onDelete} />);

    await user.click(screen.getByTestId("button-destructive"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test("calls setOpen(false) when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    const onDelete = vi.fn();

    render(<DeleteDialog open={true} setOpen={setOpen} deleteWhat="Item" onDelete={onDelete} />);

    await user.click(screen.getByTestId("button-secondary"));
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("renders custom text when provided", () => {
    const setOpen = vi.fn();
    const onDelete = vi.fn();
    const customText = "Custom confirmation message";

    render(
      <DeleteDialog open={true} setOpen={setOpen} deleteWhat="Item" onDelete={onDelete} text={customText} />
    );

    expect(screen.getByText(customText)).toBeInTheDocument();
  });

  test("renders children when provided", () => {
    const setOpen = vi.fn();
    const onDelete = vi.fn();

    render(
      <DeleteDialog open={true} setOpen={setOpen} deleteWhat="Item" onDelete={onDelete}>
        <div data-testid="child-content">Additional content</div>
      </DeleteDialog>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  test("disables delete button when disabled prop is true", () => {
    const setOpen = vi.fn();
    const onDelete = vi.fn();

    render(
      <DeleteDialog open={true} setOpen={setOpen} deleteWhat="Item" onDelete={onDelete} disabled={true} />
    );

    expect(screen.getByTestId("button-destructive")).toBeDisabled();
  });

  test("shows save button when useSaveInsteadOfCancel is true", () => {
    const setOpen = vi.fn();
    const onDelete = vi.fn();
    const onSave = vi.fn();

    render(
      <DeleteDialog
        open={true}
        setOpen={setOpen}
        deleteWhat="Item"
        onDelete={onDelete}
        useSaveInsteadOfCancel={true}
        onSave={onSave}
      />
    );

    expect(screen.getByTestId("button-secondary")).toHaveTextContent("common.save");
  });

  test("calls onSave when save button is clicked with useSaveInsteadOfCancel", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    const onDelete = vi.fn();
    const onSave = vi.fn();

    render(
      <DeleteDialog
        open={true}
        setOpen={setOpen}
        deleteWhat="Item"
        onDelete={onDelete}
        useSaveInsteadOfCancel={true}
        onSave={onSave}
      />
    );

    await user.click(screen.getByTestId("button-secondary"));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("shows loading state when isDeleting is true", () => {
    const setOpen = vi.fn();
    const onDelete = vi.fn();

    render(
      <DeleteDialog open={true} setOpen={setOpen} deleteWhat="Item" onDelete={onDelete} isDeleting={true} />
    );

    expect(screen.getByTestId("button-destructive")).toHaveAttribute("data-loading", "true");
  });

  test("shows loading state when isSaving is true", () => {
    const setOpen = vi.fn();
    const onDelete = vi.fn();

    render(
      <DeleteDialog open={true} setOpen={setOpen} deleteWhat="Item" onDelete={onDelete} isSaving={true} />
    );

    expect(screen.getByTestId("button-secondary")).toHaveAttribute("data-loading", "true");
  });
});
