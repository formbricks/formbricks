import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TActionClass, TActionClassNoCodeConfig } from "@formbricks/types/action-classes";
import { AddActionModal } from "./AddActionModal";

// Mock child components and hooks
vi.mock("@/modules/survey/editor/components/create-new-action-tab", () => ({
  CreateNewActionTab: vi.fn(({ setOpen }) => (
    <div data-testid="create-new-action-tab">
      <span>CreateNewActionTab Content</span>
      <button onClick={() => setOpen(false)}>Close from Tab</button>
    </div>
  )),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/dialog", () => {
  const React = require("react");
  const { useState } = React;

  return {
    Dialog: ({ children, open: externalOpen, onOpenChange }: any) => {
      const [internalOpen, setInternalOpen] = useState(externalOpen);

      // Update internal state when external open prop changes
      React.useEffect(() => {
        setInternalOpen(externalOpen);
      }, [externalOpen]);

      const handleOpenChange = (newOpen: boolean) => {
        setInternalOpen(newOpen);
        onOpenChange?.(newOpen);
      };

      return internalOpen ? (
        <dialog data-testid="dialog" open>
          {children}
          <button onClick={() => handleOpenChange(false)}>Close Dialog</button>
        </dialog>
      ) : null;
    },
    DialogContent: ({ children, disableCloseOnOutsideClick, ...props }: any) => (
      <div data-testid="dialog-content" {...props}>
        {children}
      </div>
    ),
    DialogHeader: ({ children }: any) => <div data-testid="dialog-header">{children}</div>,
    DialogTitle: ({ children, className }: any) => (
      <h2 data-testid="dialog-title" className={className}>
        {children}
      </h2>
    ),
    DialogDescription: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="dialog-description">{children}</div>
    ),
    DialogBody: ({ children }: any) => <div data-testid="dialog-body">{children}</div>,
  };
});

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("lucide-react", () => ({
  MousePointerClickIcon: () => <div data-testid="mouse-pointer-icon" />,
  PlusIcon: () => <div data-testid="plus-icon" />,
}));

const mockActionClasses: TActionClass[] = [
  {
    id: "action1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Action 1",
    description: "Description 1",
    type: "noCode",
    environmentId: "env1",
    noCodeConfig: { type: "click" } as unknown as TActionClassNoCodeConfig,
  } as unknown as TActionClass,
];

const environmentId = "env1";

describe("AddActionModal", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const createTestWrapper = () => {
    const TestWrapper = () => {
      const [open, setOpen] = React.useState(true);

      return (
        <AddActionModal
          environmentId={environmentId}
          actionClasses={mockActionClasses}
          isReadOnly={false}
          open={open}
          setOpen={setOpen}
        />
      );
    };
    return TestWrapper;
  };

  test("passes correct props to CreateNewActionTab", async () => {
    const { CreateNewActionTab } = await import("@/modules/survey/editor/components/create-new-action-tab");
    const mockedCreateNewActionTab = vi.mocked(CreateNewActionTab);

    render(
      <AddActionModal
        environmentId={environmentId}
        actionClasses={mockActionClasses}
        isReadOnly={false}
        open={true}
        setOpen={vi.fn()}
      />
    );

    expect(mockedCreateNewActionTab).toHaveBeenCalled();
    const props = mockedCreateNewActionTab.mock.calls[0][0];
    expect(props.environmentId).toBe(environmentId);
    expect(props.actionClasses).toEqual(mockActionClasses); // Initial state check
    expect(props.isReadOnly).toBe(false);
    expect(props.setOpen).toBeInstanceOf(Function);
    expect(props.setActionClasses).toBeInstanceOf(Function);
  });

  test("closes the dialog when the close button (simulated) is clicked", async () => {
    const TestWrapper = createTestWrapper();
    render(<TestWrapper />);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();

    // Simulate closing via the mocked Dialog's close button
    const closeDialogButton = screen.getByText("Close Dialog");
    await userEvent.click(closeDialogButton);

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  test("closes the dialog when setOpen is called from CreateNewActionTab", async () => {
    const TestWrapper = createTestWrapper();
    render(<TestWrapper />);

    expect(screen.getByTestId("dialog")).toBeInTheDocument();

    // Simulate closing via the mocked CreateNewActionTab's button
    const closeFromTabButton = screen.getByText("Close from Tab");
    await userEvent.click(closeFromTabButton);

    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });
});
