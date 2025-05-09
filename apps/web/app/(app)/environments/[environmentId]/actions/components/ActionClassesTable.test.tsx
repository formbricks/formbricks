import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TActionClass } from "@formbricks/types/action-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { ActionClassesTable } from "./ActionClassesTable";

// Mock the ActionDetailModal
vi.mock("./ActionDetailModal", () => ({
  ActionDetailModal: ({ open, actionClass, setOpen }: any) =>
    open ? (
      <div data-testid="action-detail-modal">
        Modal for {actionClass.name}
        <button onClick={() => setOpen(false)}>Close Modal</button>
      </div>
    ) : null,
}));

const mockActionClasses: TActionClass[] = [
  { id: "1", name: "Action 1", type: "noCode", environmentId: "env1" } as TActionClass,
  { id: "2", name: "Action 2", type: "code", environmentId: "env1" } as TActionClass,
];

const mockEnvironment: TEnvironment = {
  id: "env1",
  name: "Test Environment",
  type: "development",
} as unknown as TEnvironment;
const mockOtherEnvironment: TEnvironment = {
  id: "env2",
  name: "Other Environment",
  type: "production",
} as unknown as TEnvironment;

const mockTableHeading = <div data-testid="table-heading">Table Heading</div>;
const mockActionRows = mockActionClasses.map((action) => (
  <div key={action.id} data-testid={`action-row-${action.id}`}>
    {action.name} Row
  </div>
));

describe("ActionClassesTable", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders table heading and action rows when actions exist", () => {
    render(
      <ActionClassesTable
        environmentId="env1"
        actionClasses={mockActionClasses}
        environment={mockEnvironment}
        isReadOnly={false}
        otherEnvActionClasses={[]}
        otherEnvironment={mockOtherEnvironment}>
        {[mockTableHeading, mockActionRows]}
      </ActionClassesTable>
    );

    expect(screen.getByTestId("table-heading")).toBeInTheDocument();
    expect(screen.getByTestId("action-row-1")).toBeInTheDocument();
    expect(screen.getByTestId("action-row-2")).toBeInTheDocument();
    expect(screen.queryByText("No actions found")).not.toBeInTheDocument();
  });

  test("renders 'No actions found' message when no actions exist", () => {
    render(
      <ActionClassesTable
        environmentId="env1"
        actionClasses={[]}
        environment={mockEnvironment}
        isReadOnly={false}
        otherEnvActionClasses={[]}
        otherEnvironment={mockOtherEnvironment}>
        {[mockTableHeading, []]}
      </ActionClassesTable>
    );

    expect(screen.getByTestId("table-heading")).toBeInTheDocument();
    expect(screen.getByText("No actions found")).toBeInTheDocument();
    expect(screen.queryByTestId("action-row-1")).not.toBeInTheDocument();
  });

  test("opens ActionDetailModal with correct action when a row is clicked", async () => {
    render(
      <ActionClassesTable
        environmentId="env1"
        actionClasses={mockActionClasses}
        environment={mockEnvironment}
        isReadOnly={false}
        otherEnvActionClasses={[]}
        otherEnvironment={mockOtherEnvironment}>
        {[mockTableHeading, mockActionRows]}
      </ActionClassesTable>
    );

    // Modal should not be open initially
    expect(screen.queryByTestId("action-detail-modal")).not.toBeInTheDocument();

    // Find the button wrapping the first action row
    const actionButton1 = screen.getByTitle("Action 1");
    await userEvent.click(actionButton1);

    // Modal should now be open with the correct action name
    const modal = screen.getByTestId("action-detail-modal");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveTextContent("Modal for Action 1");

    // Close the modal
    await userEvent.click(screen.getByText("Close Modal"));
    expect(screen.queryByTestId("action-detail-modal")).not.toBeInTheDocument();

    // Click the second action button
    const actionButton2 = screen.getByTitle("Action 2");
    await userEvent.click(actionButton2);

    // Modal should open for the second action
    const modal2 = screen.getByTestId("action-detail-modal");
    expect(modal2).toBeInTheDocument();
    expect(modal2).toHaveTextContent("Modal for Action 2");
  });
});
