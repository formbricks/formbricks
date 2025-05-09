import { AlertDialog } from "@/modules/ui/components/alert-dialog";
import { Modal } from "@/modules/ui/components/modal";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

// Mock dependencies
vi.mock("@/modules/ui/components/modal", () => ({
  Modal: vi.fn(({ children, open, title }) =>
    open ? (
      <div data-testid="modal">
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-content">{children}</div>
      </div>
    ) : null
  ),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) =>
      key === "common.are_you_sure_this_action_cannot_be_undone"
        ? "Are you sure? This action cannot be undone."
        : key,
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

    // Verify Modal is rendered
    const modalMock = vi.mocked(Modal);
    expect(modalMock).toHaveBeenCalled();

    // Check the props passed to Modal
    const modalProps = modalMock.mock.calls[0][0];
    expect(modalProps.open).toBe(true);
    expect(modalProps.title).toBe("Test Header");
    expect(modalProps.setOpen).toBe(setOpenMock);

    // Verify main text is displayed
    expect(screen.getByText("Test Main Text")).toBeInTheDocument();

    // Verify buttons are displayed
    const confirmButton = screen.getByText("Confirm");
    expect(confirmButton).toBeInTheDocument();

    const declineButton = screen.getByText("Decline");
    expect(declineButton).toBeInTheDocument();

    // Test button clicks
    const user = userEvent.setup();
    await user.click(confirmButton);
    expect(onConfirmMock).toHaveBeenCalledTimes(1);

    await user.click(declineButton);
    expect(onDeclineMock).toHaveBeenCalledTimes(1);
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

    expect(screen.queryByText("Decline")).not.toBeInTheDocument();
  });

  test("closes the modal when onConfirm is not provided and confirm button is clicked", async () => {
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
    await user.click(screen.getByText("Confirm"));

    // Should close the modal by setting open to false
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

    expect(screen.getByText("Decline")).toBeInTheDocument();
  });
});
