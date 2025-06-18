import { AlertDialog } from "@/modules/ui/components/alert-dialog";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

// Mock the Dialog components
vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="dialog">
        {children}
        <button data-testid="dialog-close" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
  DialogContent: ({
    children,
    className,
    hideCloseButton,
  }: {
    children: React.ReactNode;
    className?: string;
    hideCloseButton?: boolean;
  }) => (
    <div data-testid="dialog-content" className={className} data-hide-close-button={hideCloseButton}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="dialog-title" className={className}>
      {children}
    </h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

// Mock Button component
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, variant, onClick }) => (
    <button data-testid={`button-${variant || "primary"}`} onClick={onClick}>
      {children}
    </button>
  ),
}));

// Mock the useTranslate hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations = {
        "common.are_you_sure_this_action_cannot_be_undone": "Are you sure? This action cannot be undone.",
      };
      return translations[key] || key;
    },
  }),
}));

describe("AlertDialog Component", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders the alert dialog with all props correctly", async () => {
    const setOpenMock = vi.fn();
    const onConfirmMock = vi.fn();
    const onDeclineMock = vi.fn();

    render(
      <AlertDialog
        open={true}
        setOpen={setOpenMock}
        headerText="Test Header"
        mainText="Test Main Text"
        confirmBtnLabel="Confirm"
        declineBtnLabel="Decline"
        declineBtnVariant="destructive"
        onConfirm={onConfirmMock}
        onDecline={onDeclineMock}
      />
    );

    // Verify Dialog is rendered
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-header")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Test Header");
    expect(screen.getByTestId("dialog-description")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-footer")).toBeInTheDocument();

    // Verify main text is displayed
    expect(screen.getByText("Test Main Text")).toBeInTheDocument();

    // Verify buttons are displayed
    const confirmButton = screen.getByTestId("button-primary");
    expect(confirmButton).toHaveTextContent("Confirm");

    const declineButton = screen.getByTestId("button-destructive");
    expect(declineButton).toHaveTextContent("Decline");

    // Test button clicks
    const user = userEvent.setup();
    await user.click(confirmButton);
    expect(onConfirmMock).toHaveBeenCalledTimes(1);

    await user.click(declineButton);
    expect(onDeclineMock).toHaveBeenCalledTimes(1);
  });

  test("does not render when closed", () => {
    render(
      <AlertDialog
        open={false}
        setOpen={vi.fn()}
        headerText="Test Header"
        mainText="Test Main Text"
        confirmBtnLabel="Confirm"
      />
    );

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  test("does not render the decline button when declineBtnLabel or onDecline is not provided", () => {
    render(
      <AlertDialog
        open={true}
        setOpen={vi.fn()}
        headerText="Test Header"
        mainText="Test Main Text"
        confirmBtnLabel="Confirm"
      />
    );

    expect(screen.queryByTestId("button-destructive")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-ghost")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-primary")).toBeInTheDocument();
  });

  test("closes the dialog when onConfirm is not provided and confirm button is clicked", async () => {
    const setOpenMock = vi.fn();

    render(
      <AlertDialog
        open={true}
        setOpen={setOpenMock}
        headerText="Test Header"
        mainText="Test Main Text"
        confirmBtnLabel="Confirm"
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByTestId("button-primary"));

    // Should close the dialog by setting open to false
    expect(setOpenMock).toHaveBeenCalledWith(false);
  });

  test("uses ghost variant for decline button by default", () => {
    const onDeclineMock = vi.fn();

    render(
      <AlertDialog
        open={true}
        setOpen={vi.fn()}
        headerText="Test Header"
        mainText="Test Main Text"
        confirmBtnLabel="Confirm"
        declineBtnLabel="Decline"
        onDecline={onDeclineMock}
      />
    );

    expect(screen.getByTestId("button-ghost")).toBeInTheDocument();
  });
});
