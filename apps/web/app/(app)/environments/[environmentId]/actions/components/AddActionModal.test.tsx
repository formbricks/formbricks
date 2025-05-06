import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("@/modules/ui/components/modal", () => ({
  Modal: ({ children, open, setOpen, ...props }: any) =>
    open ? (
      <div data-testid="modal" {...props}>
        {children}
        <button onClick={() => setOpen(false)}>Close Modal</button>
      </div>
    ) : null,
}));

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

  test("renders the 'Add Action' button initially", () => {
    render(
      <AddActionModal environmentId={environmentId} actionClasses={mockActionClasses} isReadOnly={false} />
    );
    expect(screen.getByRole("button", { name: "common.add_action" })).toBeInTheDocument();
    expect(screen.getByTestId("plus-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  test("opens the modal when the 'Add Action' button is clicked", async () => {
    render(
      <AddActionModal environmentId={environmentId} actionClasses={mockActionClasses} isReadOnly={false} />
    );
    const addButton = screen.getByRole("button", { name: "common.add_action" });
    await userEvent.click(addButton);

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByTestId("mouse-pointer-icon")).toBeInTheDocument();
    expect(screen.getByText("environments.actions.track_new_user_action")).toBeInTheDocument();
    expect(
      screen.getByText("environments.actions.track_user_action_to_display_surveys_or_create_user_segment")
    ).toBeInTheDocument();
    expect(screen.getByTestId("create-new-action-tab")).toBeInTheDocument();
  });

  test("passes correct props to CreateNewActionTab", async () => {
    const { CreateNewActionTab } = await import("@/modules/survey/editor/components/create-new-action-tab");
    const mockedCreateNewActionTab = vi.mocked(CreateNewActionTab);

    render(
      <AddActionModal environmentId={environmentId} actionClasses={mockActionClasses} isReadOnly={false} />
    );
    const addButton = screen.getByRole("button", { name: "common.add_action" });
    await userEvent.click(addButton);

    expect(mockedCreateNewActionTab).toHaveBeenCalled();
    const props = mockedCreateNewActionTab.mock.calls[0][0];
    expect(props.environmentId).toBe(environmentId);
    expect(props.actionClasses).toEqual(mockActionClasses); // Initial state check
    expect(props.isReadOnly).toBe(false);
    expect(props.setOpen).toBeInstanceOf(Function);
    expect(props.setActionClasses).toBeInstanceOf(Function);
  });

  test("closes the modal when the close button (simulated) is clicked", async () => {
    render(
      <AddActionModal environmentId={environmentId} actionClasses={mockActionClasses} isReadOnly={false} />
    );
    const addButton = screen.getByRole("button", { name: "common.add_action" });
    await userEvent.click(addButton);

    expect(screen.getByTestId("modal")).toBeInTheDocument();

    // Simulate closing via the mocked Modal's close button
    const closeModalButton = screen.getByText("Close Modal");
    await userEvent.click(closeModalButton);

    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  test("closes the modal when setOpen is called from CreateNewActionTab", async () => {
    render(
      <AddActionModal environmentId={environmentId} actionClasses={mockActionClasses} isReadOnly={false} />
    );
    const addButton = screen.getByRole("button", { name: "common.add_action" });
    await userEvent.click(addButton);

    expect(screen.getByTestId("modal")).toBeInTheDocument();

    // Simulate closing via the mocked CreateNewActionTab's button
    const closeFromTabButton = screen.getByText("Close from Tab");
    await userEvent.click(closeFromTabButton);

    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });
});
